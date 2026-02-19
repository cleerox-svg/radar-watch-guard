/**
 * ingest-threats — Supabase Edge Function
 *
 * Pulls threat intelligence from external open-source feeds and upserts
 * the results into the `threats` table. Supports three feed sources:
 *   - URLhaus (abuse.ch): Malware distribution URLs
 *   - OpenPhish: Community-maintained phishing URL feed
 *   - PhishTank: Verified phishing URL database (CSV format)
 *
 * Flow:
 *   1. Create a `feed_ingestions` audit row with status "running"
 *   2. Fetch data from the selected external API
 *   3. Normalize records into the threats table schema
 *   4. Upsert into `threats` using the `domain` unique constraint (deduplicates)
 *   5. Update the feed_ingestions row with final counts and "completed" status
 *
 * Security: Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS for writes.
 * The anon/client key can invoke this function, but all DB writes use the
 * service role so the client never needs direct INSERT permission.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key for elevated DB access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the requested feed source from the request body
    const { source } = await req.json();

    // Step 1: Create an audit record to track this ingestion run
    const { data: ingestion } = await supabase.from('feed_ingestions').insert({
      source: source || 'phishtank',
      status: 'running',
    }).select().single();

    let records: any[] = [];
    let fetchedCount = 0;
    let newCount = 0;

    /**
     * URLhaus Feed (abuse.ch)
     * Fetches recently reported malware distribution URLs.
     * Tries GET endpoint first, falls back to POST if response isn't JSON.
     * Each record maps to: brand (tags), domain (hostname), attack_type (threat category).
     */
    if (source === 'urlhaus' || !source) {
      const res = await fetch('https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      
      let data: any = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        // Fallback: POST endpoint (older API format)
        const res2 = await fetch('https://urlhaus-api.abuse.ch/v1/urls/recent/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'limit=50',
        });
        data = await res2.json();
      }
      fetchedCount = data.urls?.length || 0;

      if (data.urls) {
        // Normalize URLhaus records into our threats schema
        records = data.urls.slice(0, 50).map((u: any) => ({
          brand: u.tags?.join(', ') || 'Unknown',
          domain: new URL(u.url).hostname,
          attack_type: u.threat || 'malware_download',
          confidence: u.urlhaus_reference ? 85 : 60,
          severity: u.threat === 'malware_download' ? 'high' : 'medium',
          status: u.url_status === 'online' ? 'active' : 'mitigated',
          source: 'urlhaus',
          country: u.country || null,
          metadata: { urlhaus_id: u.id, url: u.url, tags: u.tags },
          first_seen: u.date_added || new Date().toISOString(),
          last_seen: new Date().toISOString(),
        }));
      }
    }

    /**
     * OpenPhish Feed
     * Plain-text list of active phishing URLs (one per line).
     * No API key required. We extract the hostname from each URL.
     */
    if (source === 'openphish') {
      const res = await fetch('https://openphish.com/feed.txt');
      const text = await res.text();
      const urls = text.trim().split('\n').filter(Boolean).slice(0, 50);
      fetchedCount = urls.length;

      records = urls.map((url: string) => {
        let hostname = 'unknown';
        try { hostname = new URL(url).hostname; } catch {}
        return {
          brand: 'Phishing Target',
          domain: hostname,
          attack_type: 'Phishing',
          confidence: 75,
          severity: 'high',
          status: 'active',
          source: 'openphish',
          metadata: { url },
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
        };
      });
    }

    /**
     * PhishTank Feed
     * CSV export of verified phishing URLs.
     * Columns: phish_id, url, phish_detail_url, submission_time, verified,
     *          verification_time, online, target
     * We parse the CSV manually and extract brand/target info from column 7.
     */
    if (source === 'phishtank') {
      const res = await fetch('http://data.phishtank.com/data/online-valid.csv');
      const text = await res.text();
      const lines = text.trim().split('\n');
      // Skip the CSV header row, take up to 50 data rows
      const dataLines = lines.slice(1, 51);
      fetchedCount = dataLines.length;

      records = dataLines.map((line: string) => {
        // Parse CSV with quoted fields (handles commas inside quotes)
        const cols = line.match(/(?:^|,)("(?:[^"]*(?:""[^"]*)*)"|[^,]*)/g)?.map(
          (c: string) => c.replace(/^,/, '').replace(/^"|"$/g, '').replace(/""/g, '"')
        ) || [];
        const url = cols[1] || '';
        const target = cols[7] || 'Unknown';       // Target brand being impersonated
        const submissionTime = cols[3] || new Date().toISOString();
        let hostname = 'unknown';
        try { hostname = new URL(url).hostname; } catch {}
        return {
          brand: target,
          domain: hostname,
          attack_type: 'Phishing',
          confidence: 90,    // PhishTank entries are verified
          severity: 'high' as const,
          status: 'active' as const,
          source: 'phishtank' as const,
          metadata: { phish_id: cols[0], url, detail_url: cols[2] },
          first_seen: submissionTime,
          last_seen: new Date().toISOString(),
        };
      });
    }

    /**
     * Step 3: Upsert all normalized records into the threats table.
     * Uses the unique constraint on `domain` to skip duplicates.
     * ignoreDuplicates=true means existing rows won't be overwritten.
     */
    if (records.length > 0) {
      const { data: inserted, error } = await supabase.from('threats').upsert(
        records,
        { onConflict: 'domain', ignoreDuplicates: true }
      );
      
      if (error) {
        console.error('Insert error:', error);
      }
      newCount = records.length;
    }

    // Step 4: Finalize the audit record with results
    if (ingestion) {
      await supabase.from('feed_ingestions').update({
        status: 'completed',
        records_fetched: fetchedCount,
        records_new: newCount,
        completed_at: new Date().toISOString(),
      }).eq('id', ingestion.id);
    }

    return new Response(
      JSON.stringify({ success: true, fetched: fetchedCount, new: newCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Ingestion error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

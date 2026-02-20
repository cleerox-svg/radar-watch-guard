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
      let data: any = {};
      try {
        const res = await fetch('https://urlhaus-api.abuse.ch/v1/urls/recent/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'limit=50',
        });
        const text = await res.text();
        console.log(`URLhaus POST status=${res.status} len=${text.length} preview=${text.substring(0, 300)}`);
        try { data = JSON.parse(text); } catch { console.error('URLhaus parse error'); }
      } catch (e) {
        console.error('URLhaus POST failed:', e);
      }
      
      if (!data.urls) {
        try {
          const res2 = await fetch('https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/');
          const text2 = await res2.text();
          console.log(`URLhaus GET status=${res2.status} len=${text2.length} preview=${text2.substring(0, 300)}`);
          try { data = JSON.parse(text2); } catch { console.error('URLhaus GET parse error'); }
        } catch (e) {
          console.error('URLhaus GET failed:', e);
        }
      }
      
      console.log(`URLhaus keys=${Object.keys(data).join(',')}, urls=${data.urls?.length || 0}`);
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
     * Step 3: GeoIP enrichment — resolve hostnames to country codes.
     * First DNS-resolve domains to IPs, then batch-query ip-api.com for country.
     */
    if (records.length > 0) {
      try {
        const domainsToResolve = records
          .filter((r: any) => !r.country)
          .map((r: any) => r.domain)
          .filter((d: string, i: number, arr: string[]) => arr.indexOf(d) === i)
          .slice(0, 50);

        if (domainsToResolve.length > 0) {
          // DNS resolve domains to IPs using Deno.resolveDns
          const domainToIp = new Map<string, string>();
          await Promise.allSettled(
            domainsToResolve.map(async (domain: string) => {
              try {
                const ips = await Deno.resolveDns(domain, "A");
                if (ips.length > 0) domainToIp.set(domain, ips[0]);
              } catch { /* DNS resolution failed for this domain */ }
            })
          );

          const ipsToQuery = [...domainToIp.values()].slice(0, 100);
          if (ipsToQuery.length > 0) {
          const geoRes = await fetch("http://ip-api.com/batch?fields=query,country,countryCode,status,as,org,isp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(ipsToQuery),
            });

            if (geoRes.ok) {
              const geoData: any[] = await geoRes.json();
              const ipGeoMap = new Map<string, any>();
              geoData.forEach((g: any) => {
                if (g.status === "success") {
                  ipGeoMap.set(g.query, g);
                }
              });

              // Map back: domain -> IP -> country + ASN/org/ISP
              records.forEach((r: any) => {
                if (domainToIp.has(r.domain)) {
                  const ip = domainToIp.get(r.domain)!;
                  const geo = ipGeoMap.get(ip);
                  if (geo) {
                    if (!r.country && geo.country) r.country = geo.country;
                    r.ip_address = ip;
                    if (geo.as) r.asn = geo.as;
                    if (geo.org) r.org_name = geo.org;
                    if (geo.isp) r.isp = geo.isp;
                  }
                }
              });

              console.log(`GeoIP: DNS resolved ${domainToIp.size}/${domainsToResolve.length}, geo resolved ${ipGeoMap.size}/${ipsToQuery.length}`);
            }
          } else {
            console.log(`GeoIP: DNS resolved 0/${domainsToResolve.length} domains`);
          }
        }
      } catch (geoErr) {
        console.error("GeoIP enrichment failed (non-fatal):", geoErr);
      }
    }

    /**
     * Step 4: Upsert all normalized records into the threats table.
     * Uses the unique constraint on `domain`. Updates country, ip_address,
     * last_seen, and metadata on conflict so GeoIP data persists.
     */
    if (records.length > 0) {
      // Deduplicate records by domain (keep last occurrence which has GeoIP data)
      const deduped = new Map<string, any>();
      records.forEach((r: any) => deduped.set(r.domain, r));
      const uniqueRecords = [...deduped.values()];

      const { data: inserted, error } = await supabase.from('threats').upsert(
        uniqueRecords,
        { onConflict: 'domain', ignoreDuplicates: false }
      );
      
      if (error) {
        console.error('Insert error:', error);
      }
      newCount = uniqueRecords.length;
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

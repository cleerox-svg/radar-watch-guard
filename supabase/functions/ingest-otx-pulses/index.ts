/**
 * ingest-otx-pulses — Supabase Edge Function
 *
 * Pulls threat intelligence from AlienVault OTX public indicator endpoints
 * (no API key required) and upserts into the `threat_news` table.
 *
 * Uses the indicator/general endpoint which is public and doesn't need auth.
 * Queries well-known malicious indicators to surface active threat campaigns.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Well-known threat indicators to query for recent pulse data
const INDICATORS = [
  { type: 'domain', value: 'cobalt-strike.com' },
  { type: 'domain', value: 'emotet.doc' },
  { type: 'hostname', value: 'malware-traffic-analysis.net' },
  { type: 'IPv4', value: '185.220.101.1' },  // Known Tor exit / abuse
  { type: 'IPv4', value: '45.33.32.156' },    // scanme.nmap.org
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const records: any[] = [];
    const seenTitles = new Set<string>();

    // Query each indicator's pulse_info to gather related threat campaigns
    for (const ind of INDICATORS) {
      try {
        const res = await fetch(
          `https://otx.alienvault.com/api/v1/indicators/${ind.type}/${ind.value}/general`,
          { headers: { 'Accept': 'application/json' } }
        );
        if (!res.ok) continue;
        const data = await res.json();

        // Extract pulses referencing this indicator
        const pulses = data.pulse_info?.pulses || [];
        for (const pulse of pulses.slice(0, 5)) {
          if (seenTitles.has(pulse.name)) continue;
          seenTitles.add(pulse.name);

          const hasApt = pulse.adversary ||
            pulse.tags?.some((t: string) => /apt|ransomware|zero.?day|exploit/i.test(t));
          const hasMalware = (pulse.malware_families?.length || 0) > 0;
          let severity = 'medium';
          if (hasApt) severity = 'critical';
          else if (hasMalware) severity = 'high';

          const cveEntry = pulse.attack_ids?.find((a: any) => a.id?.startsWith('CVE-'));

          const title = (pulse.name || '').substring(0, 200);
          if (!title) continue;

          records.push({
            title,
            description: (pulse.description || '').substring(0, 500) || null,
            source: 'otx',
            severity,
            url: `https://otx.alienvault.com/pulse/${pulse.id}`,
            cve_id: cveEntry?.id || null,
            vendor: pulse.adversary || null,
            product: pulse.malware_families?.join(', ') || null,
            date_published: pulse.created || new Date().toISOString(),
            metadata: {
              otx_id: pulse.id,
              tags: pulse.tags,
              targeted_countries: pulse.targeted_countries,
              indicators_count: pulse.indicator_count,
              tlp: pulse.tlp,
            },
          });
        }
      } catch {
        // Skip failed indicator lookups
      }
    }

    // Limit to 20 most useful results
    const finalRecords = records.slice(0, 20);

    let upsertedCount = 0;
    if (finalRecords.length > 0) {
      const { error } = await supabase.from('threat_news').upsert(
        finalRecords,
        { onConflict: 'source,title', ignoreDuplicates: true }
      );
      if (error) {
        console.error('OTX upsert error:', error);
        throw error;
      }
      upsertedCount = finalRecords.length;
    }

    return new Response(
      JSON.stringify({ success: true, fetched: records.length, upserted: upsertedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('OTX ingestion error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

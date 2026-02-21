/**
 * ingest-threats — Supabase Edge Function (Optimized)
 *
 * High-volume threat intelligence ingestion from external open-source feeds.
 * Supports: URLhaus, OpenPhish, PhishTank.
 *
 * Optimizations over v1:
 *   - Configurable batch_size (default 500, max 2000)
 *   - Chunked upserts (200 records per DB call)
 *   - Parallel GeoIP enrichment with DNS batching
 *   - Uses UNIQUE(domain, source) constraint for multi-feed deduplication
 *
 * Security: Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS for writes.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Chunked upsert — processes records in batches of CHUNK_SIZE */
async function chunkedUpsert(supabase: any, table: string, records: any[], onConflict: string, chunkSize = 200) {
  let total = 0;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict, ignoreDuplicates: false });
    if (error) {
      console.error(`Upsert chunk ${Math.floor(i / chunkSize)} error:`, error.message);
    } else {
      total += chunk.length;
    }
  }
  return total;
}

/** Batch DNS resolution with concurrency limit */
async function batchDnsResolve(domains: string[], concurrency = 10): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (let i = 0; i < domains.length; i += concurrency) {
    const batch = domains.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (domain) => {
        try {
          const ips = await Deno.resolveDns(domain, "A");
          if (ips.length > 0) result.set(domain, ips[0]);
        } catch { /* DNS resolution failed */ }
      })
    );
  }
  return result;
}

/** GeoIP enrichment via ip-api.com batch endpoint */
async function enrichGeoIP(records: any[]) {
  try {
    const domainsToResolve = [...new Set(
      records.filter((r: any) => !r.country).map((r: any) => r.domain)
    )].slice(0, 100);

    if (domainsToResolve.length === 0) return;

    const domainToIp = await batchDnsResolve(domainsToResolve);
    const ipsToQuery = [...domainToIp.values()].slice(0, 100);

    if (ipsToQuery.length === 0) {
      console.log(`GeoIP: DNS resolved 0/${domainsToResolve.length} domains`);
      return;
    }

    const geoRes = await fetch("http://ip-api.com/batch?fields=query,country,countryCode,status,as,org,isp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ipsToQuery),
    });

    if (!geoRes.ok) return;

    const geoData: any[] = await geoRes.json();
    const ipGeoMap = new Map<string, any>();
    geoData.forEach((g: any) => {
      if (g.status === "success") ipGeoMap.set(g.query, g);
    });

    records.forEach((r: any) => {
      const ip = domainToIp.get(r.domain);
      if (!ip) return;
      const geo = ipGeoMap.get(ip);
      if (!geo) return;
      if (!r.country && geo.country) r.country = geo.country;
      r.ip_address = ip;
      if (geo.as) r.asn = geo.as;
      if (geo.org) r.org_name = geo.org;
      if (geo.isp) r.isp = geo.isp;
    });

    console.log(`GeoIP: DNS ${domainToIp.size}/${domainsToResolve.length}, geo ${ipGeoMap.size}/${ipsToQuery.length}`);
  } catch (err) {
    console.error("GeoIP enrichment failed (non-fatal):", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { source, batch_size: requestedBatchSize } = await req.json();
    const batchSize = Math.min(requestedBatchSize || 500, 2000);

    // Audit record
    const { data: ingestion } = await supabase.from('feed_ingestions').insert({
      source: source || 'phishtank',
      status: 'running',
    }).select().single();

    let records: any[] = [];
    let fetchedCount = 0;

    // ── URLhaus Feed ──
    if (source === 'urlhaus' || !source) {
      let data: any = {};
      try {
        const res = await fetch('https://urlhaus-api.abuse.ch/v1/urls/recent/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `limit=${batchSize}`,
        });
        const text = await res.text();
        try { data = JSON.parse(text); } catch { console.error('URLhaus parse error'); }
      } catch (e) {
        console.error('URLhaus POST failed:', e);
      }

      if (!data.urls) {
        try {
          const res2 = await fetch(`https://urlhaus-api.abuse.ch/v1/urls/recent/limit/${batchSize}/`);
          const text2 = await res2.text();
          try { data = JSON.parse(text2); } catch { console.error('URLhaus GET parse error'); }
        } catch (e) {
          console.error('URLhaus GET failed:', e);
        }
      }

      fetchedCount = data.urls?.length || 0;
      if (data.urls) {
        records = data.urls.slice(0, batchSize).map((u: any) => ({
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

    // ── OpenPhish Feed ──
    if (source === 'openphish') {
      const res = await fetch('https://openphish.com/feed.txt');
      const text = await res.text();
      const urls = text.trim().split('\n').filter(Boolean).slice(0, batchSize);
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

    // ── PhishTank Feed ──
    if (source === 'phishtank') {
      const res = await fetch('http://data.phishtank.com/data/online-valid.csv');
      const text = await res.text();
      const lines = text.trim().split('\n');
      const dataLines = lines.slice(1, batchSize + 1);
      fetchedCount = dataLines.length;

      records = dataLines.map((line: string) => {
        const cols = line.match(/(?:^|,)("(?:[^"]*(?:""[^"]*)*)"|[^,]*)/g)?.map(
          (c: string) => c.replace(/^,/, '').replace(/^"|"$/g, '').replace(/""/g, '"')
        ) || [];
        const url = cols[1] || '';
        const target = cols[7] || 'Unknown';
        const submissionTime = cols[3] || new Date().toISOString();
        let hostname = 'unknown';
        try { hostname = new URL(url).hostname; } catch {}
        return {
          brand: target,
          domain: hostname,
          attack_type: 'Phishing',
          confidence: 90,
          severity: 'high' as const,
          status: 'active' as const,
          source: 'phishtank' as const,
          metadata: { phish_id: cols[0], url, detail_url: cols[2] },
          first_seen: submissionTime,
          last_seen: new Date().toISOString(),
        };
      });
    }

    // ── GeoIP Enrichment ──
    if (records.length > 0) {
      await enrichGeoIP(records);
    }

    // ── Chunked Upsert ──
    let newCount = 0;
    if (records.length > 0) {
      // Deduplicate by (domain, source)
      const deduped = new Map<string, any>();
      records.forEach((r: any) => deduped.set(`${r.domain}::${r.source}`, r));
      const uniqueRecords = [...deduped.values()];

      newCount = await chunkedUpsert(supabase, 'threats', uniqueRecords, 'domain,source');
      console.log(`Upserted ${newCount}/${uniqueRecords.length} records in chunks`);
    }

    // Finalize audit
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
  } catch (error: unknown) {
    console.error('Ingestion error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

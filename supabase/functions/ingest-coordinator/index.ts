/**
 * ingest-coordinator — Orchestration Edge Function (v2 — Tiered Scheduling)
 *
 * Dispatches parallel ingestion jobs across feed workers.
 * Supports tier-based invocation:
 *   tier=1 → critical feeds (every 5 min)
 *   tier=2 → medium-priority feeds (every 15 min)
 *   tier=3 → low-priority feeds (every 30 min)
 *   tier=4 → background feeds (every 30 min)
 *   no tier → all feeds (manual/full sweep)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Feed worker configuration — priority 1 = highest */
const FEED_WORKERS = [
  // Tier 1 — Critical (every 5 min)
  { source: 'urlhaus',       function_name: 'ingest-threats',             priority: 1, batch_size: 500, requires_key: false },
  { source: 'phishtank',     function_name: 'ingest-threats',             priority: 1, batch_size: 500, requires_key: false },
  { source: 'ransomwatch',   function_name: 'ingest-ransomwatch',         priority: 1, batch_size: 500, requires_key: false },
  { source: 'cisa_kev',      function_name: 'ingest-cisa-kev',            priority: 1, batch_size: 100, requires_key: false },
  { source: 'feodo',         function_name: 'ingest-feodo',               priority: 1, batch_size: 500, requires_key: false },
  // Tier 2 — Medium (every 15 min)
  { source: 'openphish',     function_name: 'ingest-threats',             priority: 2, batch_size: 500, requires_key: false },
  { source: 'threatfox',     function_name: 'ingest-threatfox',           priority: 2, batch_size: 500, requires_key: false },
  { source: 'malbazaar',     function_name: 'ingest-malbazaar',           priority: 2, batch_size: 500, requires_key: false },
  { source: 'spamhaus_drop', function_name: 'ingest-spamhaus-drop',       priority: 2, batch_size: 500, requires_key: false },
  { source: 'google_safebrowsing', function_name: 'ingest-google-safebrowsing', priority: 2, batch_size: 500, requires_key: true, key_env: 'GOOGLE_SAFEBROWSING_API_KEY' },
  { source: 'phishtank_community', function_name: 'ingest-phishtank-community', priority: 2, batch_size: 500, requires_key: true, key_env: 'PHISHTANK_API_KEY' },
  // API-key feeds with strict rate limits are in Tier 5 — called by dedicated cron jobs only
  // Tier 3 — Enrichment (every 30 min)
  { source: 'otx',           function_name: 'ingest-otx-pulses',          priority: 3, batch_size: 50,  requires_key: false },
  { source: 'sans_isc',      function_name: 'ingest-sans-isc',            priority: 3, batch_size: 100, requires_key: false },
  { source: 'blocklist_de',  function_name: 'ingest-blocklist-de',        priority: 3, batch_size: 400, requires_key: false },
  { source: 'ssl_blocklist', function_name: 'ingest-ssl-blocklist',       priority: 3, batch_size: 300, requires_key: false },
  { source: 'greynoise',     function_name: 'ingest-greynoise',           priority: 3, batch_size: 45,  requires_key: true, key_env: 'GREYNOISE_API_KEY' },
  // Tier 5 — Rate-limited API feeds (dedicated cron jobs, NOT called by tier crons)
  { source: 'abuseipdb',     function_name: 'ingest-abuseipdb',           priority: 5, batch_size: 200, requires_key: true, key_env: 'ABUSEIPDB_API_KEY' },
  { source: 'virustotal',    function_name: 'ingest-virustotal',          priority: 5, batch_size: 20,  requires_key: true, key_env: 'VIRUSTOTAL_API_KEY' },
  { source: 'ipqualityscore',function_name: 'ingest-ipqualityscore',      priority: 5, batch_size: 15,  requires_key: true, key_env: 'IPQUALITYSCORE_API_KEY' },
  // Tier 4 — Background (every 30 min)
  { source: 'tor_nodes',     function_name: 'ingest-tor-exits',           priority: 4, batch_size: 2000,requires_key: false },
  { source: 'mastodon',      function_name: 'ingest-mastodon',            priority: 4, batch_size: 200, requires_key: false },
  { source: 'certstream',    function_name: 'ingest-certstream',          priority: 4, batch_size: 200, requires_key: false },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let selectedFeeds = [...FEED_WORKERS];
    let tierFilter: number | null = null;

    try {
      const body = await req.json();
      // Filter by tier if specified
      if (body?.tier && typeof body.tier === 'number') {
        tierFilter = body.tier;
        selectedFeeds = FEED_WORKERS.filter(w => w.priority === tierFilter);
      }
      // Or filter by explicit sources
      if (body?.sources && Array.isArray(body.sources)) {
        selectedFeeds = FEED_WORKERS.filter(w => body.sources.includes(w.source));
      }
    } catch { /* no body = run all */ }

    // Filter out API-key feeds unless their key is available
    selectedFeeds = selectedFeeds.filter(feed => {
      if (!feed.requires_key) return true;
      const keyEnv = (feed as any).key_env;
      return keyEnv ? !!Deno.env.get(keyEnv) : false;
    });

    // Sort by priority
    selectedFeeds.sort((a, b) => a.priority - b.priority);

    if (selectedFeeds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, total_workers: 0, message: tierFilter ? `No feeds for tier ${tierFilter}` : 'No feeds selected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create job entries
    const jobInserts = selectedFeeds.map(feed => ({
      feed_source: feed.source,
      status: 'pending',
      priority: feed.priority,
      batch_size: feed.batch_size,
    }));

    const { data: jobs, error: jobErr } = await supabase
      .from('ingestion_jobs')
      .insert(jobInserts)
      .select();

    if (jobErr) {
      console.error('Failed to create jobs:', jobErr);
      throw jobErr;
    }

    console.log(`[Tier ${tierFilter ?? 'ALL'}] Created ${jobs?.length} ingestion jobs`);

    // Dispatch workers in parallel
    const dispatches = selectedFeeds.map(async (feed, idx) => {
      const jobId = jobs?.[idx]?.id;
      try {
        if (jobId) {
          await supabase.from('ingestion_jobs').update({
            status: 'running',
            started_at: new Date().toISOString(),
          }).eq('id', jobId);
        }

        const workerUrl = `${supabaseUrl}/functions/v1/${feed.function_name}`;
        const body: any = { batch_size: feed.batch_size };
        if (feed.function_name === 'ingest-threats') {
          body.source = feed.source;
        }

        const res = await fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify(body),
        });

        const result = await res.json();

        if (jobId) {
          await supabase.from('ingestion_jobs').update({
            status: result.success ? 'completed' : 'failed',
            records_processed: result.fetched || result.upserted || result.new || 0,
            error_message: result.error || null,
            completed_at: new Date().toISOString(),
          }).eq('id', jobId);
        }

        return { source: feed.source, ...result };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Worker ${feed.source} failed:`, errorMsg);

        if (jobId) {
          const { data: job } = await supabase
            .from('ingestion_jobs')
            .select('retry_count, max_retries')
            .eq('id', jobId)
            .single();

          const retryCount = (job?.retry_count || 0) + 1;
          const maxRetries = job?.max_retries || 3;

          await supabase.from('ingestion_jobs').update({
            status: retryCount < maxRetries ? 'retry_pending' : 'failed',
            error_message: errorMsg,
            retry_count: retryCount,
            completed_at: new Date().toISOString(),
          }).eq('id', jobId);
        }

        return { source: feed.source, success: false, error: errorMsg };
      }
    });

    const results = await Promise.allSettled(dispatches);
    const summary = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' }
    );

    const succeeded = summary.filter((r: any) => r.success).length;
    const failed = summary.filter((r: any) => !r.success).length;

    console.log(`[Tier ${tierFilter ?? 'ALL'}] Complete: ${succeeded} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        tier: tierFilter,
        total_workers: selectedFeeds.length,
        succeeded,
        failed,
        results: summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Coordinator error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

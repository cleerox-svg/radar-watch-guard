/**
 * ingest-coordinator — Orchestration Edge Function
 *
 * Dispatches parallel ingestion jobs across all feed workers.
 * Designed to be called by pg_cron on a schedule (e.g., every 15 min).
 *
 * Flow:
 *   1. Create ingestion_jobs entries for each feed source
 *   2. Fire-and-forget invoke each feed worker in parallel
 *   3. Return immediately with job IDs for tracking
 *
 * Supports priority ordering and batch_size configuration per feed.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Feed worker configuration — priority 1 = highest */
const FEED_WORKERS = [
  { source: 'urlhaus',     function_name: 'ingest-threats',     priority: 1, batch_size: 500 },
  { source: 'phishtank',   function_name: 'ingest-threats',     priority: 1, batch_size: 500 },
  { source: 'openphish',   function_name: 'ingest-threats',     priority: 2, batch_size: 500 },
  { source: 'threatfox',   function_name: 'ingest-threatfox',   priority: 2, batch_size: 500 },
  { source: 'ransomwatch', function_name: 'ingest-ransomwatch', priority: 1, batch_size: 500 },
  { source: 'cisa_kev',    function_name: 'ingest-cisa-kev',    priority: 1, batch_size: 100 },
  { source: 'otx',         function_name: 'ingest-otx-pulses',  priority: 3, batch_size: 50  },
  { source: 'sans_isc',    function_name: 'ingest-sans-isc',    priority: 3, batch_size: 100 },
  { source: 'tor_nodes',   function_name: 'ingest-tor-exits',   priority: 4, batch_size: 2000 },
  { source: 'mastodon',    function_name: 'ingest-mastodon',    priority: 4, batch_size: 200 },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Optional: only run specific feeds
    let selectedFeeds = FEED_WORKERS;
    try {
      const body = await req.json();
      if (body?.sources && Array.isArray(body.sources)) {
        selectedFeeds = FEED_WORKERS.filter(w => body.sources.includes(w.source));
      }
    } catch { /* no body = run all */ }

    // Sort by priority (highest first)
    selectedFeeds.sort((a, b) => a.priority - b.priority);

    // Create job entries for tracking
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

    console.log(`Created ${jobs?.length} ingestion jobs`);

    // Dispatch workers in parallel (fire-and-forget via fetch)
    const dispatches = selectedFeeds.map(async (feed, idx) => {
      const jobId = jobs?.[idx]?.id;
      try {
        // Mark job as running
        if (jobId) {
          await supabase.from('ingestion_jobs').update({
            status: 'running',
            started_at: new Date().toISOString(),
          }).eq('id', jobId);
        }

        // Call the worker function
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

        // Update job with results
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
          // Check retry count
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

    // Wait for all workers to complete
    const results = await Promise.allSettled(dispatches);
    const summary = results.map((r) =>
      r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' }
    );

    const succeeded = summary.filter((r: any) => r.success).length;
    const failed = summary.filter((r: any) => !r.success).length;

    console.log(`Coordinator complete: ${succeeded} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
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

/**
 * ingest-greynoise — GreyNoise Community API
 * Free tier: 50 requests/day. Classifies IPs as mass-scanner vs targeted.
 * Checks active threat IPs against GreyNoise for noise classification.
 * Requires: GREYNOISE_API_KEY secret.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GREYNOISE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "GREYNOISE_API_KEY not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get IPs from active threats that haven't been checked by GreyNoise
    const { data: threats } = await sb
      .from("threats")
      .select("id, ip_address, domain, metadata")
      .eq("status", "active")
      .not("ip_address", "is", null)
      .order("last_seen", { ascending: false })
      .limit(45); // Stay under 50/day limit

    if (!threats || threats.length === 0) {
      await sb.from("feed_schedules").update({
        last_run_at: new Date().toISOString(),
        last_status: "success",
        last_records: 0,
      }).eq("feed_source", "greynoise");

      return new Response(
        JSON.stringify({ success: true, checked: 0, enriched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out already-checked IPs
    const unchecked = threats.filter(t => {
      const meta = t.metadata as Record<string, unknown> | null;
      return !meta?.greynoise_checked;
    }).slice(0, 45);

    let enriched = 0;

    for (const threat of unchecked) {
      try {
        const res = await fetch(
          `https://api.greynoise.io/v3/community/${threat.ip_address}`,
          { headers: { key: apiKey, Accept: "application/json" } }
        );

        if (res.status === 429) {
          console.log("GreyNoise rate limit hit, stopping");
          break;
        }

        if (!res.ok) continue;

        const data = await res.json();
        const existingMeta = (threat.metadata as Record<string, unknown>) || {};

        await sb.from("threats").update({
          metadata: {
            ...existingMeta,
            greynoise_checked: true,
            greynoise_noise: data.noise,
            greynoise_riot: data.riot,
            greynoise_classification: data.classification,
            greynoise_name: data.name,
            greynoise_link: data.link,
            greynoise_last_seen: data.last_seen,
          },
        }).eq("id", threat.id);

        enriched++;

        // Rate limit: ~1 req/sec to be safe
        await new Promise(r => setTimeout(r, 1200));
      } catch (err) {
        console.error(`GreyNoise check failed for ${threat.ip_address}:`, err instanceof Error ? err.message : err);
      }
    }

    await sb.from("feed_schedules").update({
      last_run_at: new Date().toISOString(),
      last_status: "success",
      last_records: enriched,
    }).eq("feed_source", "greynoise");

    console.log(`GreyNoise: checked ${unchecked.length}, enriched ${enriched}`);

    return new Response(
      JSON.stringify({ success: true, checked: unchecked.length, enriched }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("GreyNoise error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

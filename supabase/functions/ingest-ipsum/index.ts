/**
 * ingest-ipsum — Pulls aggregated malicious IP data from stamparm/ipsum (free, no key).
 * IPsum is a daily-updated threat intelligence feed that aggregates 30+ blocklists.
 * Level 3+ IPs have been flagged by 3+ independent sources — high confidence indicators.
 * Data upserted into social_iocs table with source='ipsum'.
 *
 * Replaces the deprecated SSL Blocklist (abuse.ch SSLBL, deprecated 2025-01-03).
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
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse optional batch_size
    let batchSize = 300;
    try {
      const body = await req.json();
      if (body?.batch_size) batchSize = Math.min(body.batch_size, 1000);
    } catch { /* no body is fine */ }

    // Level 3 = IP seen on 3+ blocklists (high confidence)
    const res = await fetch(
      "https://raw.githubusercontent.com/stamparm/ipsum/master/levels/3.txt",
      { headers: { "User-Agent": "LRX-Radar/1.0" } }
    );
    if (!res.ok) throw new Error(`IPsum fetch error ${res.status}`);

    const text = await res.text();
    const lines = text
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#"));
    console.log(`IPsum level 3 returned ${lines.length} IPs`);

    // Take most recent entries up to batch_size
    const selected = lines.slice(0, batchSize);

    const records = selected
      .map((ip) => {
        const trimmed = ip.trim();
        if (!trimmed || trimmed.includes(" ")) return null; // skip malformed
        return {
          ioc_type: "ipv4",
          ioc_value: trimmed,
          tags: ["ipsum", "multi_blocklist", "level3"],
          source: "ipsum",
          source_url: "https://github.com/stamparm/ipsum",
          date_shared: new Date().toISOString(),
          confidence: "high",
        };
      })
      .filter(Boolean);

    let upserted = 0;
    for (let i = 0; i < records.length; i += 200) {
      const chunk = records.slice(i, i + 200);
      const { error } = await sb
        .from("social_iocs")
        .upsert(chunk, { onConflict: "source,ioc_value", ignoreDuplicates: true });
      if (error) console.error("IPsum upsert error:", error.message);
      else upserted += chunk.length;
    }

    // Update feed_schedules
    await sb
      .from("feed_schedules")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: "success",
        last_records: upserted,
      })
      .eq("feed_source", "ipsum");

    console.log(`IPsum: upserted ${upserted}/${records.length} IPs`);

    return new Response(
      JSON.stringify({ success: true, fetched: lines.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("IPsum ingestion error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

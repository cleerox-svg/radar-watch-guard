/**
 * ingest-phishtank-community — PhishTank Community API
 * Free registration required. Extended phishing URL database with
 * verified status and target brand data.
 * Requires: PHISHTANK_API_KEY secret.
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
    const apiKey = Deno.env.get("PHISHTANK_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "PHISHTANK_API_KEY not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // PhishTank API — JSON format, verified phishing URLs
    const res = await fetch(
      `https://checkurl.phishtank.com/checkurl/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `format=json&app_key=${apiKey}`,
      }
    );

    // Alternative: download the full database dump
    const dbRes = await fetch(
      `http://data.phishtank.com/data/${apiKey}/online-valid.json`,
      { headers: { "User-Agent": "LRX-Radar/1.0 (phishtank-community)" } }
    );

    let entries: any[] = [];
    if (dbRes.ok) {
      try {
        entries = await dbRes.json();
      } catch {
        console.error("PhishTank Community JSON parse error");
      }
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      await sb.from("feed_schedules").update({
        last_run_at: new Date().toISOString(),
        last_status: "empty",
        last_records: 0,
      }).eq("feed_source", "phishtank_community");

      return new Response(
        JSON.stringify({ success: true, fetched: 0, upserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`PhishTank Community returned ${entries.length} entries`);

    // Take only verified, recent entries
    const recent = entries
      .filter((e: any) => e.verified === "yes" || e.verified === true)
      .slice(0, 500);

    const records = recent.map((e: any) => {
      let hostname = "unknown";
      try { hostname = new URL(e.url).hostname; } catch { /* skip */ }
      return {
        domain: hostname,
        brand: e.target || "Phishing Target",
        attack_type: "Phishing",
        severity: "high" as const,
        source: "phishtank_community" as const,
        status: "active" as const,
        confidence: 92,
        first_seen: e.submission_time || new Date().toISOString(),
        last_seen: e.verification_time || new Date().toISOString(),
        metadata: {
          phish_id: e.phish_id,
          url: e.url,
          detail_url: e.phish_detail_url,
          verified: e.verified,
        },
      };
    });

    let upserted = 0;
    for (let i = 0; i < records.length; i += 200) {
      const chunk = records.slice(i, i + 200);
      const { error } = await sb.from("threats").upsert(chunk, {
        onConflict: "domain,source",
        ignoreDuplicates: true,
      });
      if (error) console.error("PhishTank Community upsert error:", error.message);
      else upserted += chunk.length;
    }

    await sb.from("feed_schedules").update({
      last_run_at: new Date().toISOString(),
      last_status: "success",
      last_records: upserted,
    }).eq("feed_source", "phishtank_community");

    return new Response(
      JSON.stringify({ success: true, fetched: recent.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("PhishTank Community error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * ingest-abuseipdb — AbuseIPDB API v2
 * Free tier: 1,000 checks/day, 5 reports/day.
 * Pulls blacklisted IPs with high confidence scores and enriches
 * existing threat records with abuse confidence data.
 * Requires: ABUSEIPDB_API_KEY secret.
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
    const apiKey = Deno.env.get("ABUSEIPDB_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "ABUSEIPDB_API_KEY not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Circuit breaker: skip if rate-limited within last 24 hours (5 calls/day limit)
    const { data: schedule } = await sb
      .from("feed_schedules")
      .select("last_status, last_run_at")
      .eq("feed_source", "abuseipdb")
      .single();

    if (schedule?.last_status === "rate_limited" && schedule?.last_run_at) {
      const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
      const lastRun = new Date(schedule.last_run_at).getTime();
      if (Date.now() - lastRun < cooldownMs) {
        console.log("AbuseIPDB circuit breaker OPEN — rate-limited, skipping until cooldown expires");
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "circuit_breaker_open", cooldown_remaining_h: Math.round((cooldownMs - (Date.now() - lastRun)) / 3600000) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Pull the AbuseIPDB blacklist (top reported IPs)
    const res = await fetch(
      "https://api.abuseipdb.com/api/v2/blacklist?confidenceMinimum=90&limit=200",
      {
        headers: {
          Key: apiKey,
          Accept: "application/json",
        },
      }
    );

    // Circuit breaker: trip on rate limit
    if (res.status === 429) {
      console.error("AbuseIPDB 429 rate limit — tripping circuit breaker for 24h");
      await sb.from("feed_schedules").update({
        last_run_at: new Date().toISOString(),
        last_status: "rate_limited",
        last_records: 0,
      }).eq("feed_source", "abuseipdb");
      const body = await res.text();
      return new Response(
        JSON.stringify({ success: false, error: "Rate limited — circuit breaker tripped", detail: body }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!res.ok) {
      const errText = await res.text();
      console.error("AbuseIPDB API error:", res.status, errText);
      throw new Error(`AbuseIPDB API returned ${res.status}`);
    }

    const data = await res.json();
    const entries = data?.data || [];

    console.log(`AbuseIPDB returned ${entries.length} blacklisted IPs`);

    if (entries.length === 0) {
      await sb.from("feed_schedules").update({
        last_run_at: new Date().toISOString(),
        last_status: "empty",
        last_records: 0,
      }).eq("feed_source", "abuseipdb");

      return new Response(
        JSON.stringify({ success: true, fetched: 0, upserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const records = entries.map((e: any) => ({
      domain: e.ipAddress,
      ip_address: e.ipAddress,
      brand: "AbuseIPDB Blacklist",
      attack_type: "malicious_ip",
      severity: e.abuseConfidenceScore >= 95 ? "critical" as const : "high" as const,
      source: "abuseipdb" as const,
      status: "active" as const,
      confidence: e.abuseConfidenceScore || 90,
      country: e.countryCode || null,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      metadata: {
        abuse_confidence: e.abuseConfidenceScore,
        country_code: e.countryCode,
        last_reported_at: e.lastReportedAt,
        total_reports: e.totalReports,
      },
    }));

    let upserted = 0;
    for (let i = 0; i < records.length; i += 200) {
      const chunk = records.slice(i, i + 200);
      const { error } = await sb.from("threats").upsert(chunk, {
        onConflict: "domain,source",
        ignoreDuplicates: true,
      });
      if (error) console.error("AbuseIPDB upsert error:", error.message);
      else upserted += chunk.length;
    }

    await sb.from("feed_schedules").update({
      last_run_at: new Date().toISOString(),
      last_status: "success",
      last_records: upserted,
    }).eq("feed_source", "abuseipdb");

    return new Response(
      JSON.stringify({ success: true, fetched: entries.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AbuseIPDB error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

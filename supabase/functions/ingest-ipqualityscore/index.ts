/**
 * ingest-ipqualityscore — IPQualityScore API
 * Free tier: 5,000 lookups/month. Provides fraud scoring for IPs,
 * emails, and domains with proxy/VPN/tor detection.
 * Requires: IPQUALITYSCORE_API_KEY secret.
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
    const apiKey = Deno.env.get("IPQUALITYSCORE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "IPQUALITYSCORE_API_KEY not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Circuit breaker: skip if rate-limited within last 24 hours (monthly quota)
    const { data: schedule } = await sb
      .from("feed_schedules")
      .select("last_status, last_run_at")
      .eq("feed_source", "ipqualityscore")
      .single();

    if (schedule?.last_status === "rate_limited" && schedule?.last_run_at) {
      const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
      const lastRun = new Date(schedule.last_run_at).getTime();
      if (Date.now() - lastRun < cooldownMs) {
        console.log("IPQualityScore circuit breaker OPEN — skipping until cooldown expires");
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "circuit_breaker_open", cooldown_remaining_h: Math.round((cooldownMs - (Date.now() - lastRun)) / 3600000) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // Get active threats with IPs not yet scored by IPQS
    const { data: threats } = await sb
      .from("threats")
      .select("id, ip_address, domain, metadata")
      .eq("status", "active")
      .not("ip_address", "is", null)
      .order("last_seen", { ascending: false })
      .limit(50);

    if (!threats || threats.length === 0) {
      await sb.from("feed_schedules").update({
        last_run_at: new Date().toISOString(),
        last_status: "success",
        last_records: 0,
      }).eq("feed_source", "ipqualityscore");

      return new Response(
        JSON.stringify({ success: true, checked: 0, enriched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const unchecked = threats.filter(t => {
      const meta = t.metadata as Record<string, unknown> | null;
      return !meta?.ipqs_checked;
    }).slice(0, 15); // ~15 per run to stay within monthly limits

    let enriched = 0;

    for (const threat of unchecked) {
      try {
        const res = await fetch(
          `https://ipqualityscore.com/api/json/ip/${apiKey}/${threat.ip_address}?strictness=1&allow_public_access_points=true`,
          { headers: { Accept: "application/json" } }
        );

        if (!res.ok) {
          if (res.status === 429) {
            console.error("IPQualityScore 429 rate limit — tripping circuit breaker for 24h");
            await sb.from("feed_schedules").update({
              last_run_at: new Date().toISOString(),
              last_status: "rate_limited",
              last_records: enriched,
            }).eq("feed_source", "ipqualityscore");
            const body = await res.text();
            return new Response(
              JSON.stringify({ success: false, error: "Rate limited — circuit breaker tripped", checked: unchecked.indexOf(threat), enriched }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          console.error(`IPQS error for ${threat.ip_address}: ${res.status}`);
          continue;
        }

        const data = await res.json();
        if (!data.success) continue;

        const existingMeta = (threat.metadata as Record<string, unknown>) || {};

        await sb.from("threats").update({
          metadata: {
            ...existingMeta,
            ipqs_checked: true,
            ipqs_fraud_score: data.fraud_score,
            ipqs_is_proxy: data.proxy,
            ipqs_is_vpn: data.vpn,
            ipqs_is_tor: data.tor,
            ipqs_is_bot: data.bot_status,
            ipqs_recent_abuse: data.recent_abuse,
            ipqs_country: data.country_code,
            ipqs_isp: data.ISP,
            ipqs_organization: data.organization,
          },
        }).eq("id", threat.id);

        // Update confidence based on fraud score
        if (data.fraud_score >= 85) {
          await sb.from("threats").update({
            confidence: Math.max(90, data.fraud_score),
            severity: "critical",
          }).eq("id", threat.id);
        }

        enriched++;

        // Rate limit: reasonable spacing
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`IPQS check failed for ${threat.ip_address}:`, err instanceof Error ? err.message : err);
      }
    }

    await sb.from("feed_schedules").update({
      last_run_at: new Date().toISOString(),
      last_status: "success",
      last_records: enriched,
    }).eq("feed_source", "ipqualityscore");

    console.log(`IPQualityScore: checked ${unchecked.length}, enriched ${enriched}`);

    return new Response(
      JSON.stringify({ success: true, checked: unchecked.length, enriched }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("IPQualityScore error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

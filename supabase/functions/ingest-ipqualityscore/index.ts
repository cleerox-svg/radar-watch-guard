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

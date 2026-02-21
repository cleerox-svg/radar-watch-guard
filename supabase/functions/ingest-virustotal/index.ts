/**
 * ingest-virustotal — VirusTotal API v3
 * Free tier: 500 lookups/day, 4/min.
 * Checks active threat domains against 70+ antivirus engines.
 * Enriches existing threats with VT detection counts.
 * Requires: VIRUSTOTAL_API_KEY secret.
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
    const apiKey = Deno.env.get("VIRUSTOTAL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "VIRUSTOTAL_API_KEY not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Circuit breaker: skip if rate-limited within last 1 hour (4 req/min, resets quickly)
    const { data: schedule } = await sb
      .from("feed_schedules")
      .select("last_status, last_run_at")
      .eq("feed_source", "virustotal")
      .single();

    if (schedule?.last_status === "rate_limited" && schedule?.last_run_at) {
      const cooldownMs = 60 * 60 * 1000; // 1 hour
      const lastRun = new Date(schedule.last_run_at).getTime();
      if (Date.now() - lastRun < cooldownMs) {
        console.log("VirusTotal circuit breaker OPEN — skipping until cooldown expires");
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "circuit_breaker_open", cooldown_remaining_min: Math.round((cooldownMs - (Date.now() - lastRun)) / 60000) }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // Get active threats not yet checked by VirusTotal
    const { data: threats } = await sb
      .from("threats")
      .select("id, domain, metadata")
      .eq("status", "active")
      .order("last_seen", { ascending: false })
      .limit(100);

    if (!threats || threats.length === 0) {
      await sb.from("feed_schedules").update({
        last_run_at: new Date().toISOString(),
        last_status: "success",
        last_records: 0,
      }).eq("feed_source", "virustotal");

      return new Response(
        JSON.stringify({ success: true, checked: 0, enriched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out already-checked domains
    const unchecked = threats.filter(t => {
      const meta = t.metadata as Record<string, unknown> | null;
      return !meta?.vt_checked;
    }).slice(0, 20); // Conservative: 4/min × ~5 min = 20 max

    let enriched = 0;

    for (const threat of unchecked) {
      try {
        // Skip IP-like domains (use IP endpoint instead)
        const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(threat.domain);
        const endpoint = isIp
          ? `https://www.virustotal.com/api/v3/ip_addresses/${threat.domain}`
          : `https://www.virustotal.com/api/v3/domains/${threat.domain}`;

        const res = await fetch(endpoint, {
          headers: { "x-apikey": apiKey },
        });

        if (res.status === 429) {
          console.error("VirusTotal 429 rate limit — tripping circuit breaker for 1h");
          await sb.from("feed_schedules").update({
            last_run_at: new Date().toISOString(),
            last_status: "rate_limited",
            last_records: enriched,
          }).eq("feed_source", "virustotal");
          const body = await res.text();
          return new Response(
            JSON.stringify({ success: false, error: "Rate limited — circuit breaker tripped", checked: unchecked.indexOf(threat), enriched }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!res.ok) {
          if (res.status === 404) {
            // Domain not in VT database — mark as checked
            const existingMeta = (threat.metadata as Record<string, unknown>) || {};
            await sb.from("threats").update({
              metadata: { ...existingMeta, vt_checked: true, vt_found: false },
            }).eq("id", threat.id);
          }
          continue;
        }

        const data = await res.json();
        const stats = data?.data?.attributes?.last_analysis_stats;
        const existingMeta = (threat.metadata as Record<string, unknown>) || {};

        const malicious = stats?.malicious || 0;
        const suspicious = stats?.suspicious || 0;
        const total = (stats?.malicious || 0) + (stats?.suspicious || 0) +
                      (stats?.undetected || 0) + (stats?.harmless || 0);

        // Update severity based on VT detections
        let newSeverity: string | undefined;
        if (malicious >= 10) newSeverity = "critical";
        else if (malicious >= 5) newSeverity = "high";

        const updateData: any = {
          metadata: {
            ...existingMeta,
            vt_checked: true,
            vt_found: true,
            vt_malicious: malicious,
            vt_suspicious: suspicious,
            vt_total_engines: total,
            vt_reputation: data?.data?.attributes?.reputation,
            vt_last_analysis_date: data?.data?.attributes?.last_analysis_date,
          },
        };

        if (newSeverity) updateData.severity = newSeverity;
        if (malicious + suspicious > 0) {
          updateData.confidence = Math.min(99, 60 + Math.round((malicious / Math.max(total, 1)) * 40));
        }

        await sb.from("threats").update(updateData).eq("id", threat.id);
        enriched++;

        // Rate limit: 4 req/min = 15 sec between requests
        await new Promise(r => setTimeout(r, 15500));
      } catch (err) {
        console.error(`VT check failed for ${threat.domain}:`, err instanceof Error ? err.message : err);
      }
    }

    await sb.from("feed_schedules").update({
      last_run_at: new Date().toISOString(),
      last_status: "success",
      last_records: enriched,
    }).eq("feed_source", "virustotal");

    console.log(`VirusTotal: checked ${unchecked.length}, enriched ${enriched}`);

    return new Response(
      JSON.stringify({ success: true, checked: unchecked.length, enriched }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("VirusTotal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * ingest-bgpstream — Pulls BGP routing anomalies from RIPEstat Data API.
 *
 * Detects BGP hijacks and route leaks targeting major cloud provider ASNs.
 * Uses RIPEstat's free API (no key required) to query BGP routing data.
 *
 * Monitored ASNs (major cloud providers):
 *   - AS16509 (Amazon/AWS)
 *   - AS8075  (Microsoft/Azure)
 *   - AS15169 (Google/GCP)
 *   - AS13335 (Cloudflare)
 *   - AS14618 (Amazon US-East)
 *   - AS36492 (Google Cloud)
 *   - AS8068  (Microsoft Corp)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Major cloud provider ASNs to monitor for BGP anomalies */
const CLOUD_ASNS = [
  { asn: "16509", name: "Amazon (AWS)" },
  { asn: "8075", name: "Microsoft (Azure)" },
  { asn: "15169", name: "Google (GCP)" },
  { asn: "13335", name: "Cloudflare" },
  { asn: "14618", name: "Amazon US-East" },
  { asn: "36492", name: "Google Cloud" },
];

const RIPESTAT_BASE = "https://stat.ripe.net/data";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let totalUpserted = 0;
    const errors: string[] = [];
    const allIncidents: any[] = [];

    for (const cloud of CLOUD_ASNS) {
      try {
        // Query RIPEstat for BGP routing status and announcements
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(
          `${RIPESTAT_BASE}/routing-status/data.json?resource=AS${cloud.asn}&timestamp=${new Date().toISOString()}`,
          {
            signal: controller.signal,
            headers: { "User-Agent": "TrustRadar/1.0 BGPMonitor" },
          }
        );
        clearTimeout(timer);

        if (!resp.ok) {
          errors.push(`RIPEstat AS${cloud.asn}: HTTP ${resp.status}`);
          continue;
        }

        const json = await resp.json();
        const data = json.data;

        if (!data) continue;

        // Check for anomalies: visibility drops, unexpected withdrawals
        const visibility = data.visibility?.v4?.total_peers || 0;
        const announcing = data.announced_space?.v4?.prefixes || 0;

        // If visibility is significantly below expected, flag as potential issue
        if (visibility > 0 && visibility < 100) {
          allIncidents.push({
            provider: cloud.name.split(" ")[0].toLowerCase(),
            service: `AS${cloud.asn} - ${cloud.name}`,
            incident_type: "bgp_leak",
            title: `BGP Visibility Anomaly - ${cloud.name} (AS${cloud.asn})`,
            description: `Reduced BGP visibility detected for ${cloud.name}. Only ${visibility} peers seeing routes. ${announcing} IPv4 prefixes announced.`,
            severity: visibility < 50 ? "high" : "medium",
            status: "active",
            source: "bgpstream",
            source_url: `https://stat.ripe.net/AS${cloud.asn}`,
            region: "global",
            asn: `AS${cloud.asn}`,
            attack_type: "bgp_hijack",
            impact_score: visibility < 50 ? 80 : 50,
            started_at: new Date().toISOString(),
            metadata: {
              asn: cloud.asn,
              provider_name: cloud.name,
              visibility_v4: visibility,
              announced_prefixes_v4: announcing,
              query_time: data.query_time,
            },
          });
        }

        // Also query for BGP updates/announcements to detect unusual activity
        try {
          const updCtrl = new AbortController();
          const updTimer = setTimeout(() => updCtrl.abort(), 10000);

          const updResp = await fetch(
            `${RIPESTAT_BASE}/bgp-updates/data.json?resource=AS${cloud.asn}&starttime=${new Date(Date.now() - 3600000).toISOString()}&endtime=${new Date().toISOString()}`,
            { signal: updCtrl.signal, headers: { "User-Agent": "TrustRadar/1.0" } }
          );
          clearTimeout(updTimer);

          if (updResp.ok) {
            const updJson = await updResp.json();
            const updates = updJson.data?.updates || [];
            const withdrawals = updates.filter((u: any) => u.type === "W").length;
            const announcements = updates.filter((u: any) => u.type === "A").length;

            // High withdrawal rate could indicate route hijack or leak
            if (withdrawals > 50) {
              allIncidents.push({
                provider: cloud.name.split(" ")[0].toLowerCase(),
                service: `AS${cloud.asn} - ${cloud.name}`,
                incident_type: "bgp_leak",
                title: `Elevated BGP Withdrawals - ${cloud.name} (AS${cloud.asn})`,
                description: `${withdrawals} BGP withdrawals and ${announcements} announcements in the last hour for ${cloud.name}. This may indicate route instability or a BGP hijack attempt.`,
                severity: withdrawals > 200 ? "critical" : "high",
                status: "active",
                source: "bgpstream",
                source_url: `https://stat.ripe.net/AS${cloud.asn}#tabId=routing`,
                region: "global",
                asn: `AS${cloud.asn}`,
                attack_type: "bgp_hijack",
                impact_score: withdrawals > 200 ? 90 : 65,
                started_at: new Date().toISOString(),
                metadata: {
                  asn: cloud.asn,
                  provider_name: cloud.name,
                  withdrawals_1h: withdrawals,
                  announcements_1h: announcements,
                },
              });
            }
          }
        } catch (_) {
          // BGP updates query is supplementary; skip on failure
        }
      } catch (asnErr: unknown) {
        errors.push(`AS${cloud.asn}: ${asnErr instanceof Error ? asnErr.message : String(asnErr)}`);
      }
    }

    // Upsert all discovered incidents
    if (allIncidents.length > 0) {
      const { error: upsertErr } = await supabase
        .from("cloud_incidents")
        .upsert(allIncidents, {
          onConflict: "provider,title,started_at",
          ignoreDuplicates: true,
        });

      if (upsertErr) {
        errors.push(`BGP upsert: ${upsertErr.message}`);
      } else {
        totalUpserted = allIncidents.length;
      }
    }

    await supabase.from("feed_ingestions").insert({
      source: "bgpstream" as any,
      status: errors.length === 0 ? "success" : "partial",
      records_fetched: allIncidents.length,
      records_new: totalUpserted,
      completed_at: new Date().toISOString(),
      error_message: errors.length > 0 ? errors.join("; ") : null,
    });

    return new Response(
      JSON.stringify({ success: true, monitored_asns: CLOUD_ASNS.length, incidents: allIncidents.length, upserted: totalUpserted, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("ingest-bgpstream error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * ingest-cloudflare-radar — Pulls DDoS attack trends, internet outage events,
 * and attack layer distribution from Cloudflare Radar's free API.
 *
 * Endpoints used (no API key required for basic data):
 *   - /radar/attacks/layer3/summary  (L3/L4 attack trends)
 *   - /radar/attacks/layer7/summary  (L7 attack trends)
 *
 * Enriches cloud_incidents with attack trend data and creates synthetic
 * incidents for significant DDoS activity spikes.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RADAR_BASE = "https://api.cloudflare.com/client/v4/radar";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let totalUpserted = 0;
    const errors: string[] = [];

    // Fetch Cloudflare Radar attack summaries
    const endpoints = [
      { path: "/attacks/layer3/summary", layer: "L3/L4" },
      { path: "/attacks/layer7/summary", layer: "L7" },
    ];

    for (const ep of endpoints) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);

        const resp = await fetch(`${RADAR_BASE}${ep.path}?dateRange=1d`, {
          signal: controller.signal,
          headers: { "User-Agent": "TrustRadar/1.0" },
        });
        clearTimeout(timer);

        if (!resp.ok) {
          // Cloudflare Radar may require auth token for some endpoints
          errors.push(`Radar ${ep.layer}: HTTP ${resp.status}`);
          continue;
        }

        const json = await resp.json();
        const summary = json.result?.summary_0 || json.result?.summary || json.result;

        if (summary) {
          // Create a summary incident record for the current attack landscape
          const incident = {
            provider: "cloudflare",
            service: `Cloudflare Radar ${ep.layer}`,
            incident_type: "attack",
            title: `${ep.layer} DDoS Attack Summary - ${new Date().toISOString().slice(0, 10)}`,
            description: `Cloudflare Radar ${ep.layer} attack distribution snapshot. Top protocols and vectors detected globally.`,
            severity: "info",
            status: "monitoring",
            source: "cloudflare_radar",
            source_url: "https://radar.cloudflare.com/security-and-attacks",
            region: "global",
            attack_type: "ddos",
            impact_score: 30,
            started_at: new Date().toISOString(),
            metadata: {
              layer: ep.layer,
              summary,
              snapshot_time: new Date().toISOString(),
            },
          };

          const { error: upsertErr } = await supabase
            .from("cloud_incidents")
            .upsert([incident], {
              onConflict: "provider,title,started_at",
              ignoreDuplicates: true,
            });

          if (upsertErr) {
            errors.push(`Radar ${ep.layer} upsert: ${upsertErr.message}`);
          } else {
            totalUpserted++;
          }
        }
      } catch (epErr: unknown) {
        errors.push(`Radar ${ep.layer}: ${epErr instanceof Error ? epErr.message : String(epErr)}`);
      }
    }

    // Also try to fetch internet outage events
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const resp = await fetch(`${RADAR_BASE}/annotations/outages?dateRange=7d&format=json`, {
        signal: controller.signal,
        headers: { "User-Agent": "TrustRadar/1.0" },
      });
      clearTimeout(timer);

      if (resp.ok) {
        const json = await resp.json();
        const outages = json.result?.annotations || [];

        const incidents = outages.slice(0, 30).map((o: any) => ({
          provider: o.asn ? `AS${o.asn}` : "internet",
          service: o.asName || o.locations?.[0] || "Internet",
          incident_type: "outage",
          title: o.description || `Internet outage - ${o.asName || o.locations?.[0] || "Unknown"}`,
          description: o.description || null,
          severity: "high",
          status: o.endDate ? "resolved" : "active",
          source: "cloudflare_radar",
          source_url: o.linkedUrl || "https://radar.cloudflare.com/outage-center",
          region: o.locations?.[0] || "global",
          asn: o.asn ? String(o.asn) : null,
          impact_score: 75,
          started_at: o.startDate || new Date().toISOString(),
          resolved_at: o.endDate || null,
          metadata: {
            event_type: o.eventType,
            scope: o.scope,
            asn: o.asn,
            asName: o.asName,
            locations: o.locations,
          },
        }));

        if (incidents.length > 0) {
          const { error: upsertErr } = await supabase
            .from("cloud_incidents")
            .upsert(incidents, {
              onConflict: "provider,title,started_at",
              ignoreDuplicates: true,
            });
          if (upsertErr) errors.push(`Radar outages upsert: ${upsertErr.message}`);
          else totalUpserted += incidents.length;
        }
      }
    } catch (outageErr: unknown) {
      errors.push(`Radar outages: ${outageErr instanceof Error ? outageErr.message : String(outageErr)}`);
    }

    await supabase.from("feed_ingestions").insert({
      source: "cloudflare_radar" as any,
      status: errors.length === 0 ? "success" : "partial",
      records_fetched: totalUpserted,
      records_new: totalUpserted,
      completed_at: new Date().toISOString(),
      error_message: errors.length > 0 ? errors.join("; ") : null,
    });

    return new Response(
      JSON.stringify({ success: true, upserted: totalUpserted, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("ingest-cloudflare-radar error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

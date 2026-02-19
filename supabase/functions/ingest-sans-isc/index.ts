/**
 * ingest-sans-isc — Pulls data from SANS Internet Storm Center (free, no API key).
 * Fetches top attacked ports and scanning trends.
 * Data goes into attack_metrics table.
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

    // SANS ISC DShield API — use the correct JSON endpoint
    const res = await fetch("https://isc.sans.edu/api/topports/records/20/", {
      headers: { "User-Agent": "LRX-Radar/1.0" },
    });

    const text = await res.text();
    let ports: any[] = [];
    
    // Try JSON first
    try {
      const parsed = JSON.parse(text);
      ports = Array.isArray(parsed) ? parsed : Object.values(parsed).flat();
    } catch {
      // Parse XML response
      const portMatches = [...text.matchAll(/<targetport>(\d+)<\/targetport>[\s\S]*?<records>(\d+)<\/records>/g)];
      if (portMatches.length === 0) {
        // Try alternative pattern
        const altMatches = [...text.matchAll(/port[">:\s]+(\d+)[\s\S]*?(?:records|count)[">:\s]+(\d+)/gi)];
        ports = altMatches.map(m => ({ targetport: m[1], records: m[2] }));
      } else {
        ports = portMatches.map(m => ({ targetport: m[1], records: m[2] }));
      }
    }
    console.log(`SANS ISC returned ${ports.length} port records`);

    const now = new Date().toISOString();
    const records = ports.map((p: any) => ({
      metric_name: `port_${p.targetport}`,
      metric_value: parseInt(p.records || p.count || "0", 10),
      category: "sans_isc_top_ports",
      country: null,
      recorded_at: now,
    }));

    if (records.length > 0) {
      const { error } = await sb.from("attack_metrics").insert(records);
      if (error) console.error("Insert error:", error);
    }

    // Also try daily summary (may not return JSON)
    let summaryCount = 0;
    try {
      const summaryRes = await fetch("https://isc.sans.edu/api/threatcon/", {
        headers: { "User-Agent": "LRX-Radar/1.0" },
      });
      const summaryText = await summaryRes.text();
      // Try to extract threat level from XML
      const levelMatch = summaryText.match(/<level>(\w+)<\/level>/);
      if (levelMatch) {
        const levelMap: Record<string, number> = { green: 1, yellow: 2, orange: 3, red: 4 };
        await sb.from("attack_metrics").insert({
          metric_name: "threat_level",
          metric_value: levelMap[levelMatch[1].toLowerCase()] || 1,
          category: "sans_isc_threatcon",
          recorded_at: now,
        });
        summaryCount = 1;
      }
    } catch (e) {
      console.log("Daily summary fetch skipped:", e);
    }

    return new Response(
      JSON.stringify({ success: true, ports: ports.length, dailySummary: summaryCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SANS ISC ingestion error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

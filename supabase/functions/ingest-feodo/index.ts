/**
 * ingest-feodo — Pulls botnet C2 data from Abuse.ch Feodo Tracker (free, no key).
 * Tracks Emotet, Dridex, TrickBot, QakBot C2 infrastructure.
 * Data upserted into threats table with source='feodo'.
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

    // Feodo Tracker — try multiple endpoints
    let entries: any[] = [];
    
    // Try the recommended JSON blocklist
    const urls = [
      "https://feodotracker.abuse.ch/downloads/ipblocklist.json",
      "https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json",
    ];
    
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "LRX-Radar/1.0" } });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) { entries = data; break; }
        }
      } catch { /* try next */ }
    }
    
    // Fallback: parse CSV blocklist
    if (entries.length === 0) {
      const csvRes = await fetch("https://feodotracker.abuse.ch/downloads/ipblocklist.csv", {
        headers: { "User-Agent": "LRX-Radar/1.0" },
      });
      if (csvRes.ok) {
        const text = await csvRes.text();
        const lines = text.split("\n").filter(l => l.trim() && !l.startsWith("#"));
        entries = lines.map(line => {
          const parts = line.split(",");
          return { dst_ip: parts[1]?.trim(), dst_port: parts[2]?.trim(), malware: parts[4]?.trim(), first_seen: parts[0]?.trim(), country: parts[6]?.trim() };
        }).filter(e => e.dst_ip);
      }
    }

    if (entries.length === 0) {
      // Feed may be empty post-Operation Endgame — not an error
      await sb.from("feed_schedules").update({ last_run_at: new Date().toISOString(), last_status: "empty", last_records: 0 }).eq("feed_source", "feodo");
      return new Response(
        JSON.stringify({ success: true, fetched: 0, upserted: 0, note: "Feed is currently empty (post-Operation Endgame)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log(`Feodo Tracker returned ${entries.length} C2 entries`);

    const records = entries.slice(0, 500).map((e: any) => ({
      domain: e.dst_ip || e.ip_address || "unknown",
      ip_address: e.dst_ip || e.ip_address || null,
      brand: e.malware || "botnet",
      attack_type: "c2_server",
      severity: "critical" as const,
      source: "feodo" as const,
      status: "active" as const,
      confidence: 90,
      country: e.country || null,
      first_seen: e.first_seen || new Date().toISOString(),
      last_seen: e.last_seen || new Date().toISOString(),
      metadata: { malware: e.malware, dst_port: e.dst_port, as_number: e.as_number, as_name: e.as_name },
    }));

    let upserted = 0;
    for (let i = 0; i < records.length; i += 200) {
      const chunk = records.slice(i, i + 200);
      const { error } = await sb.from("threats").upsert(chunk, { onConflict: "domain,source", ignoreDuplicates: true });
      if (error) console.error("Feodo upsert error:", error.message);
      else upserted += chunk.length;
    }

    // Update feed schedule
    await sb.from("feed_schedules").update({ last_run_at: new Date().toISOString(), last_status: "success", last_records: upserted }).eq("feed_source", "feodo");

    return new Response(
      JSON.stringify({ success: true, fetched: entries.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Feodo ingestion error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

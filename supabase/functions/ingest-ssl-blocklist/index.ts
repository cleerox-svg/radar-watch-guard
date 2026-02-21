/**
 * ingest-ssl-blocklist — Pulls SSL certificates used by botnets from Abuse.ch (free, no key).
 * Tracks JA3 fingerprints and certificate hashes associated with malware C2.
 * Data upserted into social_iocs table with source='ssl_blocklist'.
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

    // SSLBL aggressive IP blocklist (plain text, one IP per line)
    const res = await fetch("https://sslbl.abuse.ch/blacklist/sslipblacklist.csv", {
      headers: { "User-Agent": "LRX-Radar/1.0" },
    });
    if (!res.ok) throw new Error(`SSL Blocklist fetch error ${res.status}`);

    const text = await res.text();
    const lines = text.split("\n").filter(l => l.trim() && !l.startsWith("#"));
    console.log(`SSL Blocklist returned ${lines.length} entries`);

    // CSV format: first_seen,dst_ip,dst_port
    const records = lines.slice(0, 300).map(line => {
      const parts = line.split(",");
      const ip = parts[1]?.trim() || "unknown";
      const port = parts[2]?.trim() || "";
      return {
        ioc_type: "ip:port",
        ioc_value: port ? `${ip}:${port}` : ip,
        tags: ["ssl_blocklist", "botnet_c2"],
        source: "ssl_blocklist",
        source_url: "https://sslbl.abuse.ch/",
        date_shared: parts[0]?.trim() || new Date().toISOString(),
        confidence: "high",
      };
    }).filter(r => r.ioc_value !== "unknown");

    let upserted = 0;
    for (let i = 0; i < records.length; i += 200) {
      const chunk = records.slice(i, i + 200);
      const { error } = await sb.from("social_iocs").upsert(chunk, { onConflict: "source,ioc_value", ignoreDuplicates: true });
      if (error) console.error("SSL Blocklist upsert error:", error.message);
      else upserted += chunk.length;
    }

    await sb.from("feed_schedules").update({ last_run_at: new Date().toISOString(), last_status: "success", last_records: upserted }).eq("feed_source", "ssl_blocklist");

    return new Response(
      JSON.stringify({ success: true, fetched: lines.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SSL Blocklist ingestion error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

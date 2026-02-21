/**
 * ingest-spamhaus-drop — Pulls DROP/EDROP lists from Spamhaus (free, no key).
 * Tracks known spam, botnet, and C2 IP ranges (CIDR blocks).
 * Data upserted into threats table with source='spamhaus_drop'.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DROP_URLS = [
  { url: "https://www.spamhaus.org/drop/drop.txt", list: "DROP" },
  { url: "https://www.spamhaus.org/drop/edrop.txt", list: "EDROP" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let allRecords: any[] = [];

    for (const feed of DROP_URLS) {
      try {
        const res = await fetch(feed.url, { headers: { "User-Agent": "LRX-Radar/1.0" } });
        if (!res.ok) { console.error(`Spamhaus ${feed.list} fetch error ${res.status}`); continue; }

        const text = await res.text();
        const lines = text.split("\n").filter(l => l.trim() && !l.startsWith(";"));

        const records = lines.slice(0, 200).map(line => {
          const [cidr, asnInfo] = line.split(";").map(s => s.trim());
          return {
            domain: cidr || "unknown",
            ip_address: cidr?.split("/")[0] || null,
            brand: "infrastructure",
            attack_type: "spam_botnet_c2",
            severity: "critical" as const,
            source: "spamhaus_drop" as const,
            status: "active" as const,
            confidence: 95,
            asn: asnInfo || null,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            metadata: { list: feed.list, cidr_block: cidr },
          };
        }).filter(r => r.domain !== "unknown");

        allRecords.push(...records);
        console.log(`Spamhaus ${feed.list}: ${records.length} CIDR blocks`);
      } catch (e) {
        console.error(`Spamhaus ${feed.list} error:`, e instanceof Error ? e.message : e);
      }
    }

    let upserted = 0;
    for (let i = 0; i < allRecords.length; i += 200) {
      const chunk = allRecords.slice(i, i + 200);
      const { error } = await sb.from("threats").upsert(chunk, { onConflict: "domain,source", ignoreDuplicates: true });
      if (error) console.error("Spamhaus upsert error:", error.message);
      else upserted += chunk.length;
    }

    await sb.from("feed_schedules").update({ last_run_at: new Date().toISOString(), last_status: "success", last_records: upserted }).eq("feed_source", "spamhaus_drop");

    return new Response(
      JSON.stringify({ success: true, fetched: allRecords.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Spamhaus DROP ingestion error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

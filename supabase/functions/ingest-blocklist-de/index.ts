/**
 * ingest-blocklist-de — Pulls attacking IP addresses from Blocklist.de (free, no key).
 * Tracks IPs attacking SSH, mail, web, and other services globally.
 * Data upserted into threats table with source='blocklist_de'.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Blocklist.de provides category-specific lists */
const BLOCKLIST_FEEDS = [
  { url: "https://lists.blocklist.de/lists/mail.txt", category: "mail_abuse" },
  { url: "https://lists.blocklist.de/lists/ssh.txt", category: "ssh_brute_force" },
  { url: "https://lists.blocklist.de/lists/apache.txt", category: "web_attack" },
  { url: "https://lists.blocklist.de/lists/bruteforcelogin.txt", category: "brute_force" },
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

    for (const feed of BLOCKLIST_FEEDS) {
      try {
        const res = await fetch(feed.url, { headers: { "User-Agent": "LRX-Radar/1.0" } });
        if (!res.ok) { console.error(`Blocklist.de ${feed.category} fetch error ${res.status}`); continue; }

        const text = await res.text();
        const ips = text.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
        console.log(`Blocklist.de ${feed.category}: ${ips.length} IPs`);

        // Take top 100 per category to stay within limits
        const records = ips.slice(0, 100).map(ip => ({
          domain: ip,
          ip_address: ip,
          brand: "infrastructure",
          attack_type: feed.category,
          severity: "high" as const,
          source: "blocklist_de" as const,
          status: "active" as const,
          confidence: 75,
          first_seen: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          metadata: { blocklist_category: feed.category },
        }));
        allRecords.push(...records);
      } catch (e) {
        console.error(`Blocklist.de ${feed.category} error:`, e instanceof Error ? e.message : e);
      }
    }

    console.log(`Blocklist.de total: ${allRecords.length} IPs`);

    let upserted = 0;
    for (let i = 0; i < allRecords.length; i += 200) {
      const chunk = allRecords.slice(i, i + 200);
      const { error } = await sb.from("threats").upsert(chunk, { onConflict: "domain,source", ignoreDuplicates: true });
      if (error) console.error("Blocklist.de upsert error:", error.message);
      else upserted += chunk.length;
    }

    await sb.from("feed_schedules").update({ last_run_at: new Date().toISOString(), last_status: "success", last_records: upserted }).eq("feed_source", "blocklist_de");

    return new Response(
      JSON.stringify({ success: true, fetched: allRecords.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Blocklist.de ingestion error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

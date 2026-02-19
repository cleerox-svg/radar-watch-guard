/**
 * ingest-tor-exits — Pulls live Tor exit node IPs from dan.me.uk (free, no API key).
 * Cross-reference against traffic to detect dark web-routed attacks.
 * Data goes into tor_exit_nodes table.
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

    // Fetch Tor exit node list
    const res = await fetch("https://www.dan.me.uk/torlist/?exit", {
      headers: { "User-Agent": "LRX-Radar/1.0" },
    });

    if (!res.ok) throw new Error(`Tor list fetch error ${res.status}`);

    const text = await res.text();
    const ips = text
      .trim()
      .split("\n")
      .map((ip) => ip.trim())
      .filter((ip) => ip && !ip.startsWith("#") && /^[\d.]+$/.test(ip));

    console.log(`Tor exit list returned ${ips.length} IPs`);

    const now = new Date().toISOString();
    const records = ips.map((ip) => ({
      ip_address: ip,
      last_seen: now,
    }));

    // Batch upsert on ip_address unique constraint
    let upserted = 0;
    for (let i = 0; i < records.length; i += 500) {
      const batch = records.slice(i, i + 500);
      const { error } = await sb
        .from("tor_exit_nodes")
        .upsert(batch, { onConflict: "ip_address", ignoreDuplicates: false });
      if (error) console.error("Upsert batch error:", error);
      else upserted += batch.length;
    }

    return new Response(
      JSON.stringify({ success: true, fetched: ips.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Tor exit ingestion error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

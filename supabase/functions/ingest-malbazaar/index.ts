/**
 * ingest-malbazaar — Pulls malware sample intelligence from Abuse.ch MalBazaar (free, no key).
 * Tracks malware hashes, families, tags, and YARA signatures.
 * Data upserted into social_iocs table with source='malbazaar'.
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

    // MalBazaar recent samples — use the free CSV export
    const res = await fetch("https://bazaar.abuse.ch/export/csv/recent/", {
      method: "GET",
      headers: { "User-Agent": "LRX-Radar/1.0" },
    });
    if (!res.ok) throw new Error(`MalBazaar fetch error ${res.status}`);

    // Parse CSV: first_seen_utc,sha256_hash,md5_hash,sha1_hash,reporter,file_name,file_type,mime_type,signature,clamav,vtpercent,imphash,ssdeep,tlsh
    const text = await res.text();
    const lines = text.split("\n").filter(l => l.trim() && !l.startsWith("#"));
    // Skip header row
    const dataLines = lines.slice(1).slice(0, 200);
    const samples = dataLines.map(line => {
      const parts = line.split(",").map(p => p.replace(/^"|"$/g, "").trim());
      return { first_seen: parts[0], sha256_hash: parts[1], md5_hash: parts[2], reporter: parts[4], file_name: parts[5], file_type: parts[6], signature: parts[8], clamav: parts[9] };
    }).filter(s => s.sha256_hash);
    console.log(`MalBazaar returned ${samples.length} samples`);

    const records = samples.map((s: any) => {
      const tags = [s.signature, s.file_type].filter(Boolean).map((t: string) => t.toLowerCase());
      return {
        ioc_type: "sha256_hash",
        ioc_value: s.sha256_hash || s.md5_hash || "unknown",
        tags,
        source: "malbazaar",
        source_user: s.reporter || null,
        source_url: `https://bazaar.abuse.ch/sample/${s.sha256_hash}/`,
        date_shared: s.first_seen || new Date().toISOString(),
        confidence: s.clamav ? "high" : "medium",
      };
    });

    let upserted = 0;
    for (let i = 0; i < records.length; i += 200) {
      const chunk = records.slice(i, i + 200);
      const { error } = await sb.from("social_iocs").upsert(chunk, { onConflict: "source,ioc_value", ignoreDuplicates: true });
      if (error) console.error("MalBazaar upsert error:", error.message);
      else upserted += chunk.length;
    }

    await sb.from("feed_schedules").update({ last_run_at: new Date().toISOString(), last_status: "success", last_records: upserted }).eq("feed_source", "malbazaar");

    return new Response(
      JSON.stringify({ success: true, fetched: samples.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("MalBazaar ingestion error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

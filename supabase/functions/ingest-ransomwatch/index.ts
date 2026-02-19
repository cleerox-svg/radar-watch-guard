/**
 * ingest-ransomwatch — Pulls ransomware leak site victim data from Ransomwatch (GitHub).
 * Free, no API key. Outputs clean JSON of breached companies by threat actor.
 * Data goes into threat_news table with source='ransomwatch'.
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

    const res = await fetch(
      "https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json"
    );
    if (!res.ok) throw new Error(`Ransomwatch fetch error ${res.status}`);

    const posts: any[] = await res.json();
    console.log(`Ransomwatch returned ${posts.length} total posts`);

    // Take the most recent 100 posts
    const recent = posts
      .sort((a: any, b: any) => new Date(b.discovered || 0).getTime() - new Date(a.discovered || 0).getTime())
      .slice(0, 100);

    const records = recent.map((p: any) => ({
      title: `${p.group_name || "Unknown"}: ${p.post_title || "Unnamed victim"}`,
      description: `Ransomware victim posted by ${p.group_name || "unknown group"} on their leak site.`,
      source: "ransomwatch",
      severity: "critical",
      date_published: p.discovered || new Date().toISOString(),
      url: p.post_url || null,
      vendor: p.group_name || null,
      product: p.post_title || null,
      metadata: {
        group_name: p.group_name,
        post_title: p.post_title,
        post_url: p.post_url,
      },
    }));

    // Upsert based on title uniqueness (threat_news has no unique constraint on title,
    // so we check for existing entries to avoid duplicates)
    let upserted = 0;
    for (const record of records) {
      const { data: existing } = await sb
        .from("threat_news")
        .select("id")
        .eq("title", record.title)
        .eq("source", "ransomwatch")
        .limit(1);

      if (!existing || existing.length === 0) {
        const { error } = await sb.from("threat_news").insert(record);
        if (error) console.error("Insert error:", error.message);
        else upserted++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, fetched: recent.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Ransomwatch ingestion error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

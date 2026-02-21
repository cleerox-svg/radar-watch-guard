/**
 * ingest-ransomwatch — Pulls ransomware leak site victim data from Ransomwatch (GitHub).
 * Optimized: batch upsert instead of N+1 individual queries.
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

    // Parse optional batch_size from request body (default 500)
    let batchSize = 500;
    try {
      const body = await req.json();
      if (body?.batch_size) batchSize = Math.min(body.batch_size, 2000);
    } catch { /* no body is fine */ }

    const res = await fetch(
      "https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json"
    );
    if (!res.ok) throw new Error(`Ransomwatch fetch error ${res.status}`);

    const posts: any[] = await res.json();
    console.log(`Ransomwatch returned ${posts.length} total posts`);

    // Take the most recent posts up to batch_size
    const recent = posts
      .sort((a: any, b: any) => new Date(b.discovered || 0).getTime() - new Date(a.discovered || 0).getTime())
      .slice(0, batchSize);

    const records = recent.map((p: any) => ({
      title: `${p.group_name || "Unknown"}: ${p.post_title || "Unnamed victim"}`.substring(0, 200),
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

    // Batch upsert using (source, title) unique constraint instead of N+1 queries
    let upserted = 0;
    const CHUNK = 200;
    for (let i = 0; i < records.length; i += CHUNK) {
      const chunk = records.slice(i, i + CHUNK);
      const { error } = await sb.from("threat_news").upsert(
        chunk,
        { onConflict: "source,title", ignoreDuplicates: true }
      );
      if (error) {
        console.error(`Chunk ${i / CHUNK} upsert error:`, error.message);
      } else {
        upserted += chunk.length;
      }
    }

    console.log(`Ransomwatch: upserted ${upserted}/${records.length} records in ${Math.ceil(records.length / CHUNK)} chunks`);

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

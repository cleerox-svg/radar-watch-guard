/**
 * ingest-mastodon — Pulls #ThreatIntel posts from infosec.exchange (Mastodon).
 * Free, open API, no key needed. Extracts IOCs from post content.
 * Data goes into social_iocs table.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Extract IOCs (IPs, domains, URLs, hashes) from text */
function extractIOCs(text: string): Array<{ type: string; value: string }> {
  const iocs: Array<{ type: string; value: string }> = [];
  // Strip HTML tags
  const clean = text.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  // IPv4
  const ipRegex = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
  for (const m of clean.matchAll(ipRegex)) {
    if (!m[0].startsWith("0.") && !m[0].startsWith("127.")) {
      iocs.push({ type: "ip:v4", value: m[0] });
    }
  }

  // Defanged IPs/domains: [.] or (.) or hxxp
  const defanged = clean.replace(/\[\.\]/g, ".").replace(/\(\.\)/g, ".").replace(/hxxps?/gi, "http");

  // URLs
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  for (const m of defanged.matchAll(urlRegex)) {
    iocs.push({ type: "url", value: m[0] });
  }

  // SHA256
  const sha256 = /\b[a-fA-F0-9]{64}\b/g;
  for (const m of clean.matchAll(sha256)) {
    iocs.push({ type: "sha256", value: m[0].toLowerCase() });
  }

  // MD5
  const md5 = /\b[a-fA-F0-9]{32}\b/g;
  for (const m of clean.matchAll(md5)) {
    if (m[0].length === 32) iocs.push({ type: "md5", value: m[0].toLowerCase() });
  }

  return iocs;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const hashtag = body.hashtag || "threatintel";

    // Fetch recent posts with the hashtag from infosec.exchange
    // Use the public timeline with tag endpoint
    const res = await fetch(
      `https://infosec.exchange/api/v1/timelines/tag/${encodeURIComponent(hashtag)}?limit=40`,
      { headers: { Accept: "application/json", "User-Agent": "LRX-Radar/1.0" } }
    );

    if (!res.ok) {
      // Fallback: try the public local timeline
      const fallbackRes = await fetch(
        `https://infosec.exchange/api/v1/timelines/public?local=true&limit=40`,
        { headers: { Accept: "application/json", "User-Agent": "LRX-Radar/1.0" } }
      );
      if (!fallbackRes.ok) throw new Error(`Mastodon API error ${fallbackRes.status}`);
      var posts: any[] = await fallbackRes.json();
    } else {
      var posts: any[] = await res.json();
    }
    console.log(`Mastodon #${hashtag} returned ${posts.length} posts`);

    const records: any[] = [];
    for (const post of posts) {
      const content = post.content || "";
      const iocs = extractIOCs(content);
      const tags = (post.tags || []).map((t: any) => (t.name || t).toLowerCase());

      if (iocs.length === 0) {
        // Even without extracted IOCs, store the post reference as intel
        records.push({
          ioc_type: "post",
          ioc_value: post.url || post.uri || `mastodon-${post.id}`,
          tags: tags.length > 0 ? tags : ["threatintel"],
          source: "mastodon",
          source_user: post.account?.acct || post.account?.username || null,
          source_url: post.url || null,
          date_shared: post.created_at || new Date().toISOString(),
          confidence: "low",
        });
      } else {
        for (const ioc of iocs) {
          records.push({
            ioc_type: ioc.type,
            ioc_value: ioc.value,
            tags: tags.length > 0 ? tags : ["threatintel"],
            source: "mastodon",
            source_user: post.account?.acct || null,
            source_url: post.url || null,
            date_shared: post.created_at || new Date().toISOString(),
            confidence: iocs.length > 2 ? "high" : "medium",
          });
        }
      }
    }

    // Deduplicate within this batch
    const seen = new Set<string>();
    const unique = records.filter((r) => {
      const key = `${r.source}:${r.ioc_value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let upserted = 0;
    for (let i = 0; i < unique.length; i += 500) {
      const batch = unique.slice(i, i + 500);
      const { error } = await sb
        .from("social_iocs")
        .upsert(batch, { onConflict: "source,ioc_value", ignoreDuplicates: true });
      if (error) console.error("Upsert error:", error);
      else upserted += batch.length;
    }

    return new Response(
      JSON.stringify({ success: true, posts: posts.length, iocs_extracted: unique.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Mastodon ingestion error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

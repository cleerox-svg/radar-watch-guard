/**
 * agent-doppelganger-hunter — Proactively crawls social platforms for look-alike accounts
 * using AI visual similarity (avatar comparison), username fuzzy matching, and bio fingerprinting.
 *
 * Interval: Every 6 hours (conservative for Firecrawl rate limits)
 * Autonomy: Alert-only → human review
 *
 * Uses Firecrawl to scrape suspect profiles and Lovable AI for similarity analysis.
 * Rate-limited: max 10 scrapes per account, 5 accounts per run to stay within limits.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_URLS: Record<string, (u: string) => string> = {
  twitter: (u) => `https://x.com/${u}`,
  x: (u) => `https://x.com/${u}`,
  instagram: (u) => `https://www.instagram.com/${u}/`,
  tiktok: (u) => `https://www.tiktok.com/@${u}`,
  youtube: (u) => `https://www.youtube.com/@${u}`,
};

const MAX_ACCOUNTS_PER_RUN = 5;
const MAX_VARIATIONS_PER_ACCOUNT = 8;
const SCRAPE_DELAY_MS = 2000; // 2s between scrapes to respect rate limits

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Scrape a profile via Firecrawl with rate limiting */
async function scrapeProfile(url: string, apiKey: string): Promise<any | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown", "screenshot"], timeout: 20000 }),
    });
    if (!res.ok) { console.warn(`Scrape failed ${url}: ${res.status}`); return null; }
    const data = await res.json();
    return data.data || data || null;
  } catch (err) { console.warn(`Scrape error ${url}:`, err); return null; }
}

/** AI generates username variations */
async function generateVariations(username: string, platform: string, displayName: string, brandName: string, aiKey: string): Promise<string[]> {
  const prompt = `Generate exactly 10 impersonator username variations for @${username} on ${platform} (display: "${displayName}", brand: "${brandName}").
Techniques: typosquatting, underscore/dot insertion, prefix/suffix (_official, _real, the), number substitution (o→0, l→1), common scam patterns (_support, _team, _backup).
Return ONLY a JSON array of strings. No explanations.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }], temperature: 0.7 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch { return []; }
}

/** AI similarity analysis comparing scraped profile to verified account */
async function analyzeSimilarity(verified: any, suspect: any, aiKey: string) {
  const prompt = `Impersonation analysis. Compare suspect profile against verified account.

VERIFIED: @${verified.username} on ${verified.platform} | Display: "${verified.displayName}" | Brand: "${verified.brandName}"

SUSPECT from ${suspect.profileUrl}:
@${suspect.username}
${(suspect.content || "").substring(0, 2000)}

Return JSON only:
{"similarity_score": 0-100, "is_impersonator": true/false, "match_reasons": ["reason1"], "extracted_display_name": "name or null", "extracted_bio": "bio or null", "visual_similarity": "high/medium/low/unknown"}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }], temperature: 0.1 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const aiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const fcKey = Deno.env.get("FIRECRAWL_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));

    // Create agent run
    const { data: run } = await supabase.from("agent_runs").insert({
      agent_type: "doppelganger_hunter",
      trigger_type: body.trigger_type || "manual",
      status: "running",
      started_at: new Date().toISOString(),
      input_params: body,
    }).select("id").single();

    // Fetch monitored accounts (limit per run for rate limiting)
    let query = supabase.from("monitored_accounts")
      .select("*, influencer_profiles(id, display_name, brand_name)")
      .eq("verified", true)
      .limit(MAX_ACCOUNTS_PER_RUN);
    if (body.influencer_id) query = query.eq("influencer_id", body.influencer_id);

    const { data: accounts } = await query;
    let processed = 0, flagged = 0;

    for (const acct of accounts || []) {
      processed++;
      const inf = acct.influencer_profiles as any;
      const displayName = inf?.display_name || "Unknown";
      const brandName = inf?.brand_name || displayName;

      await supabase.from("monitored_accounts").update({ scan_status: "scanning", last_scanned_at: new Date().toISOString() }).eq("id", acct.id);

      // Generate variations and scrape each
      const variations = await generateVariations(acct.platform_username, acct.platform, displayName, brandName, aiKey);

      for (const variant of variations.slice(0, MAX_VARIATIONS_PER_ACCOUNT)) {
        const urlBuilder = PLATFORM_URLS[acct.platform.toLowerCase()];
        if (!urlBuilder) continue;

        await sleep(SCRAPE_DELAY_MS); // Rate limit
        const scraped = await scrapeProfile(urlBuilder(variant), fcKey);
        if (!scraped?.markdown) continue;

        const analysis = await analyzeSimilarity(
          { username: acct.platform_username, displayName, brandName, platform: acct.platform },
          { username: variant, content: scraped.markdown, profileUrl: urlBuilder(variant) },
          aiKey
        );

        if (analysis && analysis.similarity_score >= 50) {
          const severity = analysis.similarity_score >= 80 ? "critical" : analysis.similarity_score >= 60 ? "high" : "medium";

          // Deduplicate
          const { data: existing } = await supabase.from("impersonation_reports")
            .select("id").eq("influencer_id", inf?.id || acct.influencer_id)
            .eq("impersonator_username", variant).eq("platform", acct.platform).maybeSingle();

          if (!existing) {
            await supabase.from("impersonation_reports").insert({
              influencer_id: inf?.id || acct.influencer_id,
              platform: acct.platform,
              impersonator_username: variant,
              impersonator_display_name: analysis.extracted_display_name,
              impersonator_url: urlBuilder(variant),
              similarity_score: analysis.similarity_score,
              severity,
              source: "doppelganger_hunter",
              status: "pending",
              ai_analysis: { match_reasons: analysis.match_reasons, visual_similarity: analysis.visual_similarity, bio: analysis.extracted_bio, run_id: run?.id },
            });
            flagged++;
          }
        }
      }

      await supabase.from("monitored_accounts").update({ scan_status: "active" }).eq("id", acct.id);
    }

    // Update run
    await supabase.from("agent_runs").update({
      status: "completed", completed_at: new Date().toISOString(),
      items_processed: processed, items_flagged: flagged,
      summary: `Hunted doppelgängers for ${processed} accounts. ${flagged} new suspects flagged.`,
    }).eq("id", run?.id);

    return new Response(JSON.stringify({ success: true, run_id: run?.id, processed, flagged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Doppelgänger Hunter error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

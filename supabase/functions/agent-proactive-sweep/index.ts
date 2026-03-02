/**
 * agent-proactive-sweep — Proactively discovers impersonator accounts across
 * 6 major social platforms using Google search (via Firecrawl) + AI analysis.
 *
 * Strategy:
 * 1. For each monitored influencer, queries Google via Firecrawl search
 *    using "site:{platform}" filters for brand name / display name
 * 2. Scrapes discovered profile pages via Firecrawl
 * 3. AI compares scraped content against verified influencer identity
 * 4. High-similarity matches → impersonation_reports for HITL review
 *
 * Platforms: Facebook, TikTok, X/Twitter, Instagram, LinkedIn, YouTube
 * Interval: Daily (recommended) — rate-limited to respect Firecrawl quotas
 * Autonomy: Alert-only → human review required
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Platform-specific Google search queries and URL patterns */
const PLATFORM_SEARCH_CONFIG: Record<string, {
  siteFilter: string;
  excludePatterns?: string[];
  profileUrlPattern: RegExp;
  extractUsername: (url: string) => string | null;
}> = {
  instagram: {
    siteFilter: "site:instagram.com",
    excludePatterns: ["-site:instagram.com/p/", "-site:instagram.com/reel/", "-site:instagram.com/stories/"],
    profileUrlPattern: /instagram\.com\/([a-zA-Z0-9_.]+)\/?$/,
    extractUsername: (url) => url.match(/instagram\.com\/([a-zA-Z0-9_.]+)\/?/)?.[1] || null,
  },
  tiktok: {
    siteFilter: "site:tiktok.com",
    excludePatterns: ["-site:tiktok.com/video/", "-/t/"],
    profileUrlPattern: /tiktok\.com\/@([a-zA-Z0-9_.]+)/,
    extractUsername: (url) => url.match(/tiktok\.com\/@([a-zA-Z0-9_.]+)/)?.[1] || null,
  },
  twitter: {
    siteFilter: "site:x.com OR site:twitter.com",
    excludePatterns: ["-/status/"],
    profileUrlPattern: /(x\.com|twitter\.com)\/([a-zA-Z0-9_]+)\/?$/,
    extractUsername: (url) => url.match(/(x\.com|twitter\.com)\/([a-zA-Z0-9_]+)\/?$/)?.[2] || null,
  },
  youtube: {
    siteFilter: "site:youtube.com",
    excludePatterns: ["-/watch", "-/shorts/", "-/playlist"],
    profileUrlPattern: /youtube\.com\/@?([a-zA-Z0-9_.-]+)/,
    extractUsername: (url) => url.match(/youtube\.com\/@([a-zA-Z0-9_.-]+)/)?.[1] || null,
  },
  facebook: {
    siteFilter: "site:facebook.com",
    excludePatterns: ["-/posts/", "-/photos/", "-/videos/", "-/groups/", "-/events/"],
    profileUrlPattern: /facebook\.com\/([a-zA-Z0-9_.]+)\/?$/,
    extractUsername: (url) => url.match(/facebook\.com\/([a-zA-Z0-9_.]+)\/?$/)?.[1] || null,
  },
  linkedin: {
    siteFilter: "site:linkedin.com/in/",
    excludePatterns: [],
    profileUrlPattern: /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/,
    extractUsername: (url) => url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/)?.[1] || null,
  },
};

const PLATFORMS = Object.keys(PLATFORM_SEARCH_CONFIG);
const MAX_INFLUENCERS_PER_RUN = 3;
const MAX_SEARCH_RESULTS_PER_PLATFORM = 5;
const SCRAPE_DELAY_MS = 2000;
const SEARCH_DELAY_MS = 3000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Search Google via Firecrawl for profiles matching an influencer */
async function searchPlatform(
  brandName: string,
  displayName: string,
  platform: string,
  fcKey: string
): Promise<Array<{ url: string; title: string; description: string }>> {
  const config = PLATFORM_SEARCH_CONFIG[platform];
  if (!config) return [];

  const excludes = config.excludePatterns?.join(" ") || "";
  const query = `${config.siteFilter} "${brandName}" ${displayName !== brandName ? `OR "${displayName}"` : ""} ${excludes}`.trim();

  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fcKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: MAX_SEARCH_RESULTS_PER_PLATFORM,
      }),
    });

    if (!res.ok) {
      console.warn(`Search failed for ${platform}: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results = data.data || data.results || [];

    // Filter to actual profile URLs
    return results
      .filter((r: any) => r.url && config.profileUrlPattern.test(r.url))
      .map((r: any) => ({
        url: r.url,
        title: r.title || "",
        description: r.description || "",
      }));
  } catch (err) {
    console.warn(`Search error for ${platform}:`, err);
    return [];
  }
}

/** Scrape a profile page via Firecrawl */
async function scrapeProfile(url: string, fcKey: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fcKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"], timeout: 20000 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.markdown || data.markdown || null;
  } catch {
    return null;
  }
}

/** AI compares scraped profile against the verified influencer identity */
async function analyzeImpersonation(
  influencer: { displayName: string; brandName: string; bio: string | null; platforms: string[] },
  suspect: { url: string; username: string; platform: string; content: string; searchTitle: string },
  aiKey: string
): Promise<{
  is_impersonator: boolean;
  similarity_score: number;
  match_reasons: string[];
  extracted_display_name: string | null;
  extracted_bio: string | null;
} | null> {
  const prompt = `Impersonation detection analysis. Determine if this discovered account is impersonating the verified influencer.

VERIFIED INFLUENCER:
- Display Name: "${influencer.displayName}"
- Brand Name: "${influencer.brandName}"
- Bio: "${influencer.bio || "N/A"}"
- Known platforms: ${influencer.platforms.join(", ")}

DISCOVERED ACCOUNT:
- Platform: ${suspect.platform}
- URL: ${suspect.url}
- Username: @${suspect.username}
- Search result title: "${suspect.searchTitle}"
- Scraped content:
${suspect.content.substring(0, 3000)}

CRITICAL: This is NOT the same person's real account — those are already tracked.
Analyze if this account is IMPERSONATING the influencer by:
- Copying display name, bio, or branding
- Using similar/confusing username variations
- Posting content that mimics or references the influencer
- Using stolen photos or brand assets

A fan page, parody, or news mention is NOT impersonation.

Return JSON only:
{
  "is_impersonator": true/false,
  "similarity_score": 0-100,
  "match_reasons": ["reason1", "reason2"],
  "extracted_display_name": "name or null",
  "extracted_bio": "bio or null"
}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Setup ──
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const aiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const fcKey = Deno.env.get("FIRECRAWL_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));

    // ── Create agent run ──
    const { data: run } = await supabase
      .from("agent_runs")
      .insert({
        agent_type: "proactive_sweep",
        trigger_type: body.trigger_type || "manual",
        status: "running",
        started_at: new Date().toISOString(),
        input_params: body,
      })
      .select("id")
      .single();

    // ── Get influencers to sweep ──
    let infQuery = supabase
      .from("influencer_profiles")
      .select("id, display_name, brand_name, bio")
      .limit(MAX_INFLUENCERS_PER_RUN);

    if (body.influencer_id) {
      infQuery = infQuery.eq("id", body.influencer_id);
    }

    const { data: influencers } = await infQuery;
    let processed = 0;
    let flagged = 0;
    const errors: string[] = [];

    for (const inf of influencers || []) {
      processed++;
      const brandName = inf.brand_name || inf.display_name;
      const displayName = inf.display_name;

      // Get already-known accounts & reports for dedup
      const [monitoredRes, reportsRes] = await Promise.all([
        supabase.from("monitored_accounts").select("platform, platform_username").eq("influencer_id", inf.id),
        supabase
          .from("impersonation_reports")
          .select("platform, impersonator_username")
          .eq("influencer_id", inf.id),
      ]);

      const knownUsernames = new Set(
        (monitoredRes.data || []).map((a: any) => `${a.platform.toLowerCase()}:${a.platform_username.toLowerCase()}`)
      );
      const existingReports = new Set(
        (reportsRes.data || []).map((r: any) => `${r.platform.toLowerCase()}:${r.impersonator_username.toLowerCase()}`)
      );
      const knownPlatforms = (monitoredRes.data || []).map((a: any) => `${a.platform} (@${a.platform_username})`);

      // ── Sweep each platform ──
      for (const platform of PLATFORMS) {
        await sleep(SEARCH_DELAY_MS);

        const searchResults = await searchPlatform(brandName, displayName, platform, fcKey);
        if (searchResults.length === 0) continue;

        for (const result of searchResults) {
          const config = PLATFORM_SEARCH_CONFIG[platform];
          const username = config.extractUsername(result.url);
          if (!username) continue;

          // Skip known accounts
          const dedupeKey = `${platform}:${username.toLowerCase()}`;
          if (knownUsernames.has(dedupeKey) || existingReports.has(dedupeKey)) continue;

          // Skip common non-profile pages
          if (["explore", "about", "help", "login", "signup", "settings"].includes(username.toLowerCase())) continue;

          // Scrape the profile
          await sleep(SCRAPE_DELAY_MS);
          const markdown = await scrapeProfile(result.url, fcKey);
          if (!markdown || markdown.length < 50) continue;

          // AI analysis
          const analysis = await analyzeImpersonation(
            { displayName, brandName, bio: inf.bio, platforms: knownPlatforms },
            { url: result.url, username, platform, content: markdown, searchTitle: result.title },
            aiKey
          );

          if (analysis && analysis.similarity_score >= 50 && analysis.is_impersonator) {
            const severity =
              analysis.similarity_score >= 80 ? "critical" : analysis.similarity_score >= 65 ? "high" : "medium";

            const { error: insertErr } = await supabase.from("impersonation_reports").insert({
              influencer_id: inf.id,
              platform,
              impersonator_username: username,
              impersonator_display_name: analysis.extracted_display_name,
              impersonator_url: result.url,
              similarity_score: analysis.similarity_score,
              severity,
              source: "proactive_sweep",
              status: "pending",
              ai_analysis: {
                match_reasons: analysis.match_reasons,
                extracted_bio: analysis.extracted_bio,
                search_title: result.title,
                run_id: run?.id,
                sweep_platform: platform,
                search_query: `${brandName} on ${platform}`,
              },
            });

            if (!insertErr) {
              flagged++;
              existingReports.add(dedupeKey);
            } else {
              console.warn(`Insert error for ${username} on ${platform}:`, insertErr.message);
            }
          }
        }
      }
    }

    // ── Update run ──
    await supabase
      .from("agent_runs")
      .update({
        status: errors.length > 0 ? "completed_with_errors" : "completed",
        completed_at: new Date().toISOString(),
        items_processed: processed,
        items_flagged: flagged,
        summary: `Proactive sweep across ${PLATFORMS.length} platforms for ${processed} influencer(s). Discovered ${flagged} potential impersonator(s) for review.`,
        error_message: errors.length > 0 ? errors.join("; ") : null,
      })
      .eq("id", run?.id);

    return new Response(
      JSON.stringify({ success: true, run_id: run?.id, processed, flagged }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Proactive Sweep error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

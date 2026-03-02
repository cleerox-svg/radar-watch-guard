/**
 * agent-cross-platform-discovery — Discovers an influencer's accounts across
 * social media platforms by starting from one known monitored account.
 *
 * Flow:
 * 1. Takes a monitored account (e.g. TikTok @username)
 * 2. AI generates likely usernames for other platforms
 * 3. Firecrawl scrapes candidate profiles
 * 4. AI compares scraped profiles against the verified account
 * 5. High-similarity matches go into account_discoveries for HITL review
 *
 * Interval: On-demand (manual) + auto on new account + weekly sweep
 * Autonomy: Discovery only → human review required
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALL_PLATFORMS = ["twitter", "instagram", "tiktok", "youtube", "facebook", "threads", "twitch", "linkedin"];

const PLATFORM_URLS: Record<string, (u: string) => string> = {
  twitter: (u) => `https://x.com/${u}`,
  x: (u) => `https://x.com/${u}`,
  instagram: (u) => `https://www.instagram.com/${u}/`,
  tiktok: (u) => `https://www.tiktok.com/@${u}`,
  youtube: (u) => `https://www.youtube.com/@${u}`,
  facebook: (u) => `https://www.facebook.com/${u}`,
  threads: (u) => `https://www.threads.net/@${u}`,
  twitch: (u) => `https://www.twitch.tv/${u}`,
  linkedin: (u) => `https://www.linkedin.com/in/${u}`,
};

const MAX_ACCOUNTS_PER_RUN = 5;
const MAX_PLATFORMS_PER_ACCOUNT = 6;
const SCRAPE_DELAY_MS = 2000;

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Scrape a profile via Firecrawl */
async function scrapeProfile(url: string, apiKey: string): Promise<any | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], timeout: 20000 }),
    });
    if (!res.ok) { console.warn(`Scrape failed ${url}: ${res.status}`); return null; }
    const data = await res.json();
    return data.data || data || null;
  } catch (err) { console.warn(`Scrape error ${url}:`, err); return null; }
}

/** AI generates cross-platform username candidates */
async function generateCrossPlatformUsernames(
  username: string, platform: string, displayName: string, bio: string | null,
  targetPlatforms: string[], aiKey: string
): Promise<Record<string, string[]>> {
  const prompt = `Given @${username} on ${platform} (display name: "${displayName}", bio: "${bio || 'N/A'}"),
generate likely usernames this SAME person would use on these platforms: ${targetPlatforms.join(", ")}.

Consider:
- Exact same username (most common)
- Platform-specific adaptations (underscores vs dots)
- Official/verified patterns (_official suffix)
- Brand-consistent variations

Return JSON only, mapping platform to array of 2-4 candidate usernames:
{"instagram": ["name1", "name2"], "youtube": ["name1"]}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }], temperature: 0.3 }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : {};
  } catch { return {}; }
}

/** AI compares scraped profile to the original verified account */
async function analyzeMatch(verified: any, suspect: any, aiKey: string) {
  const prompt = `Cross-platform account verification. Determine if these are the SAME person (not an impersonator).

KNOWN VERIFIED ACCOUNT:
Platform: ${verified.platform} | Username: @${verified.username}
Display Name: "${verified.displayName}"
Bio: "${verified.bio || 'N/A'}"

CANDIDATE ACCOUNT found on ${suspect.platform}:
URL: ${suspect.url}
Content scraped:
${(suspect.content || "").substring(0, 3000)}

Analyze whether this candidate is likely the SAME PERSON as the verified account.
Consider: matching display names, consistent branding, cross-references between accounts, content themes.

Return JSON only:
{
  "is_same_person": true/false,
  "confidence": 0-100,
  "match_signals": ["signal1", "signal2"],
  "extracted_display_name": "name or null",
  "extracted_bio": "bio or null",
  "extracted_avatar_url": "url or null",
  "extracted_follower_count": number or null
}`;

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

    // Create agent run record
    const { data: run } = await supabase.from("agent_runs").insert({
      agent_type: "cross_platform_discovery",
      trigger_type: body.trigger_type || "manual",
      status: "running",
      started_at: new Date().toISOString(),
      input_params: body,
    }).select("id").single();

    // Get monitored accounts to process
    let query = supabase.from("monitored_accounts")
      .select("*, influencer_profiles(id, display_name, brand_name, bio)")
      .limit(MAX_ACCOUNTS_PER_RUN);

    if (body.monitored_account_id) {
      query = query.eq("id", body.monitored_account_id);
    } else if (body.influencer_id) {
      query = query.eq("influencer_id", body.influencer_id);
    }

    const { data: accounts } = await query;
    let processed = 0, discovered = 0;

    for (const acct of accounts || []) {
      processed++;
      const inf = acct.influencer_profiles as any;
      const displayName = acct.current_display_name || inf?.display_name || acct.platform_username;
      const bio = acct.current_bio || inf?.bio;

      // Determine which platforms to search (exclude current + already monitored)
      const { data: existingAccounts } = await supabase
        .from("monitored_accounts")
        .select("platform")
        .eq("influencer_id", acct.influencer_id);

      const { data: existingDiscoveries } = await supabase
        .from("account_discoveries")
        .select("discovered_platform, discovered_username")
        .eq("influencer_id", acct.influencer_id);

      const monitoredPlatforms = new Set((existingAccounts || []).map((a: any) => a.platform.toLowerCase()));
      const discoveredKeys = new Set((existingDiscoveries || []).map((d: any) => `${d.discovered_platform}:${d.discovered_username}`));

      const targetPlatforms = ALL_PLATFORMS.filter(p => !monitoredPlatforms.has(p) && p !== acct.platform.toLowerCase())
        .slice(0, MAX_PLATFORMS_PER_ACCOUNT);

      if (targetPlatforms.length === 0) continue;

      // AI generates username candidates per platform
      const candidates = await generateCrossPlatformUsernames(
        acct.platform_username, acct.platform, displayName, bio, targetPlatforms, aiKey
      );

      for (const [platform, usernames] of Object.entries(candidates)) {
        const urlBuilder = PLATFORM_URLS[platform];
        if (!urlBuilder || !Array.isArray(usernames)) continue;

        for (const candidate of usernames.slice(0, 3)) {
          const dedupeKey = `${platform}:${candidate}`;
          if (discoveredKeys.has(dedupeKey)) continue;

          await sleep(SCRAPE_DELAY_MS);
          const profileUrl = urlBuilder(candidate);
          const scraped = await scrapeProfile(profileUrl, fcKey);
          if (!scraped?.markdown) continue;

          const analysis = await analyzeMatch(
            { username: acct.platform_username, displayName, bio, platform: acct.platform },
            { username: candidate, content: scraped.markdown, url: profileUrl, platform },
            aiKey
          );

          if (analysis && analysis.confidence >= 40) {
            // Insert into discoveries for HITL review
            const { error: insertErr } = await supabase.from("account_discoveries").upsert({
              influencer_id: acct.influencer_id,
              source_account_id: acct.id,
              source_platform: acct.platform,
              source_username: acct.platform_username,
              discovered_platform: platform,
              discovered_username: candidate,
              discovered_url: profileUrl,
              discovered_display_name: analysis.extracted_display_name,
              discovered_bio: analysis.extracted_bio,
              discovered_avatar_url: analysis.extracted_avatar_url,
              discovered_follower_count: analysis.extracted_follower_count,
              similarity_score: analysis.confidence,
              ai_analysis: {
                is_same_person: analysis.is_same_person,
                match_signals: analysis.match_signals,
                run_id: run?.id,
                source_account: `@${acct.platform_username} on ${acct.platform}`,
              },
              status: "pending_review",
              agent_run_id: run?.id,
            }, { onConflict: "influencer_id,discovered_platform,discovered_username" });

            if (!insertErr) {
              discovered++;
              discoveredKeys.add(dedupeKey);
            }
          }
        }
      }
    }

    // Update run
    await supabase.from("agent_runs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      items_processed: processed,
      items_flagged: discovered,
      summary: `Scanned ${processed} source account(s). Discovered ${discovered} potential cross-platform account(s) for review.`,
    }).eq("id", run?.id);

    return new Response(JSON.stringify({ success: true, run_id: run?.id, processed, discovered }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cross-Platform Discovery error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

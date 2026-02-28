/**
 * agent-imprsn8-scanner — Enhanced scanner agent that discovers impersonators
 * across social platforms using Firecrawl scraping + AI analysis.
 *
 * Discovery strategies:
 * 1. Username variations — AI generates likely fake handles, Firecrawl scrapes them
 * 2. Bio/content matching — Scrapes profile bios and compares against verified accounts
 * 3. Follower reports — Processes pending crowd-sourced reports
 * 4. Scheduled sweeps — Runs full scans on a cron schedule
 *
 * Alert-only: flags and reports, never takes autonomous action.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_PROFILE_URLS: Record<string, (username: string) => string> = {
  twitter: (u) => `https://x.com/${u}`,
  x: (u) => `https://x.com/${u}`,
  instagram: (u) => `https://www.instagram.com/${u}/`,
  tiktok: (u) => `https://www.tiktok.com/@${u}`,
  youtube: (u) => `https://www.youtube.com/@${u}`,
};

interface ScanResult {
  account_id: string;
  platform: string;
  username: string;
  suspects: SuspectProfile[];
}

interface SuspectProfile {
  username: string;
  platform: string;
  profile_url: string;
  display_name: string | null;
  bio: string | null;
  similarity_score: number;
  match_reasons: string[];
}

/** Use Firecrawl to scrape a profile page */
async function scrapeProfile(url: string, firecrawlKey: string): Promise<any | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        timeout: 15000,
      }),
    });

    if (!res.ok) {
      console.warn(`Firecrawl scrape failed for ${url}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data.data || null;
  } catch (err) {
    console.warn(`Firecrawl error for ${url}:`, err);
    return null;
  }
}

/** Use AI to generate username variations for a given handle */
async function generateUsernameVariations(
  username: string,
  platform: string,
  displayName: string,
  brandName: string,
  lovableKey: string
): Promise<string[]> {
  const prompt = `Generate 15 likely impersonator username variations for the following verified social media account. Think like a scammer trying to deceive followers.

Verified account:
- Platform: ${platform}
- Username: @${username}
- Display name: ${displayName}
- Brand: ${brandName}

Generate variations using these techniques:
- Typosquatting (swapped/missing letters)
- Underscore/dot insertion (@${username}_official, @${username}.real)
- Prefix/suffix additions (@real${username}, @${username}backup, @the${username})
- Number substitutions (o→0, l→1, e→3)
- Unicode homoglyphs
- Common impersonation patterns (@${username}support, @${username}team)

Return ONLY a JSON array of strings. No duplicates. No explanations.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
  } catch (err) {
    console.error("Username variation generation failed:", err);
  }
  return [];
}

/** Use AI to compare a scraped profile against a verified account */
async function analyzeProfileSimilarity(
  verified: { username: string; displayName: string; brandName: string; platform: string },
  suspect: { username: string; scrapedContent: string; profileUrl: string },
  lovableKey: string
): Promise<{ similarity_score: number; match_reasons: string[]; display_name: string | null; bio: string | null } | null> {
  const prompt = `You are an impersonation detection analyst. Compare a suspect profile against a verified account and determine if it's an impersonator.

VERIFIED ACCOUNT:
- Platform: ${verified.platform}
- Username: @${verified.username}
- Display Name: ${verified.displayName}
- Brand: ${verified.brandName}

SUSPECT PROFILE (scraped content from ${suspect.profileUrl}):
Username: @${suspect.username}
Content:
${suspect.scrapedContent.substring(0, 2000)}

Analyze and return JSON:
{
  "similarity_score": 0-100 (how likely this is an impersonator, 0=definitely not, 100=certain),
  "is_impersonator": true/false (true if score >= 60),
  "match_reasons": ["reason1", "reason2"] (specific reasons for the score),
  "extracted_display_name": "display name found on profile or null",
  "extracted_bio": "bio text found on profile or null"
}

Consider: username similarity, display name copying, bio plagiarism, brand name usage, follower-bait patterns.
Return ONLY valid JSON.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        similarity_score: parsed.similarity_score || 0,
        match_reasons: parsed.match_reasons || [],
        display_name: parsed.extracted_display_name || null,
        bio: parsed.extracted_bio || null,
      };
    }
  } catch (err) {
    console.error("Profile analysis failed:", err);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    if (!lovableApiKey || !firecrawlKey) {
      throw new Error("Missing required API keys (LOVABLE_API_KEY, FIRECRAWL_API_KEY)");
    }

    const body = await req.json().catch(() => ({}));
    const influencerId = body.influencer_id;
    const platform = body.platform;
    const scanType = body.scan_type || "full"; // full | variations_only | reports_only

    // 1. Create agent run record
    const { data: run, error: runErr } = await supabase.from("agent_runs").insert({
      agent_type: "imprsn8_scanner",
      trigger_type: body.trigger_type || "manual",
      status: "running",
      started_at: new Date().toISOString(),
      input_params: { influencer_id: influencerId, platform, scan_type: scanType },
    }).select("id").single();

    if (runErr) throw new Error(`Failed to create agent run: ${runErr.message}`);

    // 2. Fetch monitored accounts
    let query = supabase.from("monitored_accounts")
      .select("*, influencer_profiles(id, display_name, brand_name)")
      .eq("verified", true);
    if (influencerId) query = query.eq("influencer_id", influencerId);
    if (platform) query = query.eq("platform", platform);

    const { data: accounts, error: acctErr } = await query;
    if (acctErr) throw new Error(`Failed to fetch accounts: ${acctErr.message}`);

    let processed = 0;
    let flagged = 0;
    const results: ScanResult[] = [];

    for (const account of accounts || []) {
      processed++;
      const influencer = account.influencer_profiles as any;
      const displayName = influencer?.display_name || "Unknown";
      const brandName = influencer?.brand_name || displayName;
      const influencerProfileId = influencer?.id || account.influencer_id;

      // Mark as scanning
      await supabase.from("monitored_accounts")
        .update({ scan_status: "scanning", last_scanned_at: new Date().toISOString() })
        .eq("id", account.id);

      const suspects: SuspectProfile[] = [];

      // --- Strategy 1: Username Variations ---
      if (scanType === "full" || scanType === "variations_only") {
        const variations = await generateUsernameVariations(
          account.platform_username,
          account.platform,
          displayName,
          brandName,
          lovableApiKey
        );

        // Scrape each variation's profile page
        for (const variant of variations.slice(0, 10)) { // limit to 10 per account
          const urlBuilder = PLATFORM_PROFILE_URLS[account.platform.toLowerCase()];
          if (!urlBuilder) continue;

          const profileUrl = urlBuilder(variant);
          const scraped = await scrapeProfile(profileUrl, firecrawlKey);

          if (scraped?.markdown) {
            // Profile exists — analyze it
            const analysis = await analyzeProfileSimilarity(
              { username: account.platform_username, displayName, brandName, platform: account.platform },
              { username: variant, scrapedContent: scraped.markdown, profileUrl },
              lovableApiKey
            );

            if (analysis && analysis.similarity_score >= 50) {
              suspects.push({
                username: variant,
                platform: account.platform,
                profile_url: profileUrl,
                display_name: analysis.display_name,
                bio: analysis.bio,
                similarity_score: analysis.similarity_score,
                match_reasons: analysis.match_reasons,
              });
            }
          }
        }
      }

      // --- Strategy 2: Bio/Content Matching (scrape the verified account for comparison baseline) ---
      if (scanType === "full") {
        const urlBuilder = PLATFORM_PROFILE_URLS[account.platform.toLowerCase()];
        if (urlBuilder && account.platform_url) {
          const verifiedScrape = await scrapeProfile(account.platform_url, firecrawlKey);
          if (verifiedScrape?.markdown) {
            // Store baseline content for future comparisons
            await supabase.from("monitored_accounts").update({
              metadata: {
                ...(account.metadata as any || {}),
                last_bio_snapshot: verifiedScrape.markdown.substring(0, 1000),
                bio_captured_at: new Date().toISOString(),
              },
            }).eq("id", account.id);
          }
        }
      }

      // --- Create impersonation reports for flagged suspects ---
      for (const suspect of suspects) {
        const severity = suspect.similarity_score >= 80 ? "critical"
          : suspect.similarity_score >= 60 ? "high" : "medium";

        // Check if report already exists for this impersonator
        const { data: existing } = await supabase.from("impersonation_reports")
          .select("id")
          .eq("influencer_id", influencerProfileId)
          .eq("impersonator_username", suspect.username)
          .eq("platform", suspect.platform)
          .maybeSingle();

        if (!existing) {
          await supabase.from("impersonation_reports").insert({
            influencer_id: influencerProfileId,
            platform: suspect.platform,
            impersonator_username: suspect.username,
            impersonator_display_name: suspect.display_name,
            impersonator_url: suspect.profile_url,
            similarity_score: suspect.similarity_score,
            severity,
            source: "scanner_agent",
            status: "pending",
            ai_analysis: {
              match_reasons: suspect.match_reasons,
              bio_snippet: suspect.bio,
              scan_run_id: run.id,
            },
          });
          flagged++;
        }
      }

      results.push({
        account_id: account.id,
        platform: account.platform,
        username: account.platform_username,
        suspects,
      });

      // Mark scan complete
      await supabase.from("monitored_accounts")
        .update({ scan_status: "active" })
        .eq("id", account.id);
    }

    // 3. Process pending follower reports (Strategy 3)
    if (scanType === "full" || scanType === "reports_only") {
      const { data: pendingReports } = await supabase.from("impersonation_reports")
        .select("*, influencer_profiles(display_name, brand_name)")
        .eq("source", "follower_report")
        .eq("status", "pending")
        .is("ai_analysis", null)
        .limit(20);

      for (const report of pendingReports || []) {
        const influencer = report.influencer_profiles as any;
        const urlBuilder = PLATFORM_PROFILE_URLS[report.platform.toLowerCase()];

        if (urlBuilder && report.impersonator_username) {
          const profileUrl = report.impersonator_url || urlBuilder(report.impersonator_username);
          const scraped = await scrapeProfile(profileUrl, firecrawlKey);

          if (scraped?.markdown) {
            const analysis = await analyzeProfileSimilarity(
              {
                username: report.impersonator_username,
                displayName: influencer?.display_name || "Unknown",
                brandName: influencer?.brand_name || "Unknown",
                platform: report.platform,
              },
              { username: report.impersonator_username, scrapedContent: scraped.markdown, profileUrl },
              lovableApiKey
            );

            if (analysis) {
              const severity = analysis.similarity_score >= 80 ? "critical"
                : analysis.similarity_score >= 60 ? "high" : "medium";

              await supabase.from("impersonation_reports").update({
                similarity_score: analysis.similarity_score,
                severity,
                ai_analysis: {
                  match_reasons: analysis.match_reasons,
                  bio_snippet: analysis.bio,
                  display_name_found: analysis.display_name,
                  scan_run_id: run.id,
                },
                status: analysis.similarity_score >= 50 ? "confirmed" : "dismissed",
              }).eq("id", report.id);
            }
          }
        }
      }
    }

    // 4. Update agent run
    const platformSet = new Set((accounts || []).map((a: any) => a.platform));
    await supabase.from("agent_runs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      items_processed: processed,
      items_flagged: flagged,
      results: { scans: results },
      summary: `Scanned ${processed} accounts across ${platformSet.size} platforms. ${flagged} new impersonator reports created.`,
    }).eq("id", run.id);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        processed,
        flagged,
        results,
        summary: `Scanned ${processed} accounts. ${flagged} new suspects flagged.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Scanner agent error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

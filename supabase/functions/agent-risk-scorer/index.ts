/**
 * agent-risk-scorer — AI-powered Imposter Risk Scoring Agent
 * Analyzes all data points for monitored accounts and calculates a risk score (0-100).
 * 0 = definitely fake/imposter, 100 = definitely real/legitimate.
 * Continuously refines scores based on profile snapshots, discoveries, and reports.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AccountData {
  id: string;
  platform: string;
  platform_username: string;
  current_display_name: string | null;
  current_bio: string | null;
  current_follower_count: number | null;
  current_following_count: number | null;
  current_post_count: number | null;
  current_verified: boolean | null;
  verified: boolean | null;
  current_avatar_url: string | null;
  profile_changes_count: number | null;
  influencer_id: string;
  influencer_name?: string;
  snapshots_count?: number;
  reports_count?: number;
  has_profile_data: boolean;
}

/**
 * Calculate a LEGITIMACY score: 0 = likely fake, 100 = definitely real.
 * Key principle: accounts with NO profile data yet should score neutral (50),
 * not be penalized as suspicious.
 */
function calculateHeuristicScore(acct: AccountData): { score: number; factors: Record<string, any> } {
  const factors: Record<string, any> = {};

  // If we have no profile data at all, return neutral — we can't judge
  if (!acct.has_profile_data) {
    return {
      score: 50,
      factors: { no_data: { impact: 0, detail: "No profile data fetched yet — score is neutral until data is available" } },
    };
  }

  let score = 50; // Start neutral

  // Platform verification is strong signal of legitimacy
  if (acct.current_verified || acct.verified) {
    score += 35;
    factors.platform_verified = { impact: 35, detail: "Verified by platform — strong legitimacy signal" };
  }

  // Follower count analysis
  const followers = acct.current_follower_count;
  const following = acct.current_following_count;
  const posts = acct.current_post_count;

  if (followers != null) {
    if (followers > 100000) {
      score += 20;
      factors.high_followers = { impact: 20, detail: `${followers.toLocaleString()} followers — established account` };
    } else if (followers > 10000) {
      score += 15;
      factors.good_followers = { impact: 15, detail: `${followers.toLocaleString()} followers` };
    } else if (followers > 1000) {
      score += 8;
      factors.moderate_followers = { impact: 8, detail: `${followers.toLocaleString()} followers` };
    } else if (followers > 100) {
      score += 3;
      factors.some_followers = { impact: 3, detail: `${followers.toLocaleString()} followers` };
    } else if (followers < 10) {
      score -= 10;
      factors.very_low_followers = { impact: -10, detail: `Only ${followers} followers — unusual for a known figure` };
    }
  }

  // Suspicious ratio: following >> followers with low posts (bot-like)
  if (following != null && followers != null && followers > 0) {
    const ratio = following / followers;
    if (ratio > 10 && (posts ?? 0) < 20) {
      score -= 15;
      factors.suspicious_ratio = { impact: -15, detail: `Following/follower ratio: ${ratio.toFixed(1)} — bot-like pattern` };
    }
  }

  // Post count analysis
  if (posts != null) {
    if (posts > 100) {
      score += 10;
      factors.active_poster = { impact: 10, detail: `${posts} posts — active account` };
    } else if (posts > 10) {
      score += 5;
      factors.some_posts = { impact: 5, detail: `${posts} posts` };
    } else if (posts === 0) {
      score -= 10;
      factors.no_posts = { impact: -10, detail: "Zero posts — could indicate shell account" };
    }
  }

  // Avatar present = more legitimate
  if (acct.current_avatar_url) {
    score += 5;
    factors.has_avatar = { impact: 5, detail: "Has profile picture" };
  } else {
    score -= 5;
    factors.no_avatar = { impact: -5, detail: "No profile picture" };
  }

  // Bio present = more legitimate
  if (acct.current_bio) {
    score += 5;
    factors.has_bio = { impact: 5, detail: "Has bio set" };
  }

  // Profile changes (moderate changes are normal, excessive is suspicious)
  const changes = acct.profile_changes_count ?? 0;
  if (changes > 10) {
    score -= 8;
    factors.frequent_changes = { impact: -8, detail: `${changes} profile changes detected — unusual activity` };
  }

  // Existing impersonation reports reduce legitimacy score
  if ((acct.reports_count ?? 0) > 0) {
    const reportPenalty = Math.min(20, (acct.reports_count ?? 0) * 5);
    score -= reportPenalty;
    factors.has_reports = { impact: -reportPenalty, detail: `${acct.reports_count} impersonation reports filed against this account` };
  }

  // Display name matching influencer name boosts legitimacy
  if (acct.current_display_name && acct.influencer_name) {
    const displayLower = acct.current_display_name.toLowerCase();
    const influencerLower = acct.influencer_name.toLowerCase();
    if (displayLower.includes(influencerLower) || influencerLower.includes(displayLower)) {
      score += 5;
      factors.name_match = { impact: 5, detail: "Display name matches influencer name" };
    }
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  return { score, factors };
}

/**
 * Legitimacy-based categories (higher score = more legitimate)
 */
function scoreToCategory(score: number): string {
  if (score >= 80) return "legitimate";
  if (score >= 60) return "low_risk";
  if (score >= 40) return "suspicious";
  if (score >= 20) return "likely_imposter";
  return "confirmed_imposter";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { influencer_id, account_id, run_id } = body;

    if (run_id) {
      await supabase.from("agent_runs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", run_id);
    }

    // Build query for accounts to score
    let query = supabase.from("monitored_accounts")
      .select("*, influencer_profiles(display_name)");

    if (account_id) {
      query = query.eq("id", account_id);
    } else if (influencer_id) {
      query = query.eq("influencer_id", influencer_id);
    }
    // If neither account_id nor influencer_id provided, score ALL accounts

    const { data: accounts, error: acctErr } = await query;
    if (acctErr) throw acctErr;
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ success: true, scored: 0, message: "No accounts to score" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get related data counts
    const accountIds = accounts.map((a: any) => a.id);
    const influencerIds = [...new Set(accounts.map((a: any) => a.influencer_id))];

    const [snapshotsRes, reportsRes] = await Promise.all([
      supabase.from("account_profile_snapshots").select("monitored_account_id").in("monitored_account_id", accountIds),
      supabase.from("impersonation_reports").select("influencer_id").in("influencer_id", influencerIds),
    ]);

    const snapshotCounts: Record<string, number> = {};
    for (const s of snapshotsRes.data || []) {
      snapshotCounts[s.monitored_account_id] = (snapshotCounts[s.monitored_account_id] || 0) + 1;
    }
    const reportCounts: Record<string, number> = {};
    for (const r of reportsRes.data || []) {
      reportCounts[r.influencer_id] = (reportCounts[r.influencer_id] || 0) + 1;
    }

    let scored = 0;
    const results: any[] = [];

    for (const acct of accounts) {
      // Determine if we have any real profile data
      const hasProfileData = (
        acct.current_follower_count != null ||
        acct.current_following_count != null ||
        acct.current_post_count != null ||
        acct.current_bio != null ||
        acct.current_display_name != null
      );

      const accountData: AccountData = {
        ...acct,
        influencer_name: (acct as any).influencer_profiles?.display_name,
        snapshots_count: snapshotCounts[acct.id] || 0,
        reports_count: reportCounts[acct.influencer_id] || 0,
        has_profile_data: hasProfileData,
      };

      let finalScore: number;
      let finalFactors: Record<string, any>;
      let aiEnhanced = false;

      // Heuristic scoring first
      const { score: heuristicScore, factors: heuristicFactors } = calculateHeuristicScore(accountData);
      finalScore = heuristicScore;
      finalFactors = heuristicFactors;

      // AI enhancement only if we have real data to analyze
      if (lovableKey && hasProfileData) {
        try {
          const prompt = `Analyze this social media account and rate its LEGITIMACY on a scale of 0-100 where 0=definitely fake/imposter and 100=definitely real/legitimate. Return ONLY a JSON object with "score" (0-100) and "analysis" (one sentence).

Account: @${acct.platform_username} on ${acct.platform}
Display name: ${acct.current_display_name || "not set"}
Bio: ${acct.current_bio || "not set"}
Followers: ${acct.current_follower_count ?? "unknown"}
Following: ${acct.current_following_count ?? "unknown"}
Posts: ${acct.current_post_count ?? "unknown"}
Platform verified: ${acct.current_verified ? "yes" : "no"}
Profile changes detected: ${acct.profile_changes_count ?? 0}
Associated influencer/brand: ${accountData.influencer_name}
Current heuristic legitimacy score: ${heuristicScore}/100

IMPORTANT: This account is being monitored as part of a brand protection system. A HIGH score means the account appears LEGITIMATE. A LOW score means it appears FAKE or suspicious.`;

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "You are a social media account legitimacy analyst. Evaluate accounts and determine if they are REAL/LEGITIMATE (high score) or FAKE/IMPOSTER (low score). Return ONLY valid JSON with 'score' (0-100, 100=legitimate) and 'analysis' (one sentence)." },
                { role: "user", content: prompt },
              ],
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (typeof parsed.score === "number") {
                // Blend: 60% AI, 40% heuristic
                finalScore = Math.round(parsed.score * 0.6 + heuristicScore * 0.4);
                finalFactors.ai_analysis = { impact: parsed.score - heuristicScore, detail: parsed.analysis || "AI analysis complete" };
                aiEnhanced = true;
              }
            }
          } else {
            await aiResp.text(); // consume body
          }
        } catch (aiErr) {
          console.warn("AI scoring fallback to heuristic:", aiErr);
        }
      }

      finalScore = Math.max(0, Math.min(100, finalScore));
      const category = scoreToCategory(finalScore);

      // Update the account
      await supabase.from("monitored_accounts").update({
        risk_score: finalScore,
        risk_category: category,
        risk_factors: finalFactors,
        last_risk_scored_at: new Date().toISOString(),
      }).eq("id", acct.id);

      scored++;
      results.push({
        id: acct.id,
        username: acct.platform_username,
        platform: acct.platform,
        risk_score: finalScore,
        risk_category: category,
        ai_enhanced: aiEnhanced,
      });
    }

    if (run_id) {
      await supabase.from("agent_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary: `Scored ${scored} accounts. ${results.filter(r => r.risk_score < 40).length} flagged as suspicious+`,
        items_processed: scored,
        items_flagged: results.filter(r => r.risk_score < 40).length,
        results: { scores: results },
      }).eq("id", run_id);
    }

    return new Response(JSON.stringify({ success: true, scored, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("agent-risk-scorer error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

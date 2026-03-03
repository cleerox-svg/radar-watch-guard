/**
 * agent-risk-scorer — AI-powered Imposter Risk Scoring Agent
 * Analyzes all data points for monitored accounts and calculates a risk score (0-100).
 * 0 = definitely real/legitimate, 100 = definitely fake/imposter.
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
  profile_changes_count: number | null;
  influencer_id: string;
  influencer_name?: string;
  snapshots_count?: number;
  discoveries_count?: number;
  reports_count?: number;
  has_avatar?: boolean;
  account_age_days?: number | null;
}

function calculateHeuristicScore(acct: AccountData): { score: number; factors: Record<string, any> } {
  const factors: Record<string, any> = {};
  let score = 50; // Start neutral

  // Platform verification is strong signal of legitimacy
  if (acct.current_verified || acct.verified) {
    score -= 30;
    factors.platform_verified = { impact: -30, detail: "Verified by platform" };
  }

  // Follower count analysis
  const followers = acct.current_follower_count ?? 0;
  const following = acct.current_following_count ?? 0;
  const posts = acct.current_post_count ?? 0;

  if (followers > 10000) {
    score -= 10;
    factors.high_followers = { impact: -10, detail: `${followers} followers` };
  } else if (followers < 50) {
    score += 15;
    factors.low_followers = { impact: 15, detail: `Only ${followers} followers` };
  }

  // Suspicious ratio: following >> followers with low posts
  if (following > 0 && followers > 0) {
    const ratio = following / followers;
    if (ratio > 10 && posts < 20) {
      score += 20;
      factors.suspicious_ratio = { impact: 20, detail: `Following/follower ratio: ${ratio.toFixed(1)}` };
    }
  }

  // No posts is suspicious
  if (posts === 0) {
    score += 15;
    factors.no_posts = { impact: 15, detail: "Zero posts" };
  } else if (posts < 5) {
    score += 8;
    factors.few_posts = { impact: 8, detail: `Only ${posts} posts` };
  }

  // No avatar
  if (!acct.has_avatar) {
    score += 10;
    factors.no_avatar = { impact: 10, detail: "No profile picture" };
  }

  // Profile changes (frequent changes = suspicious)
  const changes = acct.profile_changes_count ?? 0;
  if (changes > 5) {
    score += 10;
    factors.frequent_changes = { impact: 10, detail: `${changes} profile changes detected` };
  }

  // Existing impersonation reports
  if ((acct.reports_count ?? 0) > 0) {
    score += 20;
    factors.has_reports = { impact: 20, detail: `${acct.reports_count} impersonation reports filed` };
  }

  // No bio
  if (!acct.current_bio) {
    score += 5;
    factors.no_bio = { impact: 5, detail: "No bio set" };
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  return { score, factors };
}

function scoreToCategory(score: number): string {
  if (score <= 20) return "legitimate";
  if (score <= 45) return "low_risk";
  if (score <= 65) return "suspicious";
  if (score <= 85) return "likely_imposter";
  return "confirmed_imposter";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    
    // Auth check
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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

    const { data: accounts, error: acctErr } = await query;
    if (acctErr) throw acctErr;
    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ success: true, scored: 0, message: "No accounts to score" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get related data counts for scoring context
    const accountIds = accounts.map((a: any) => a.id);
    const influencerIds = [...new Set(accounts.map((a: any) => a.influencer_id))];

    const [snapshotsRes, discoveriesRes, reportsRes] = await Promise.all([
      supabase.from("account_profile_snapshots").select("monitored_account_id").in("monitored_account_id", accountIds),
      supabase.from("account_discoveries").select("influencer_id, source_account_id").in("influencer_id", influencerIds),
      supabase.from("impersonation_reports").select("influencer_id").in("influencer_id", influencerIds),
    ]);

    // Build counts maps
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
      const accountData: AccountData = {
        ...acct,
        influencer_name: (acct as any).influencer_profiles?.display_name,
        snapshots_count: snapshotCounts[acct.id] || 0,
        reports_count: reportCounts[acct.influencer_id] || 0,
        has_avatar: !!(acct as any).current_avatar_url,
      };

      let finalScore: number;
      let finalFactors: Record<string, any>;
      let aiEnhanced = false;

      // Heuristic scoring first
      const { score: heuristicScore, factors: heuristicFactors } = calculateHeuristicScore(accountData);
      finalScore = heuristicScore;
      finalFactors = heuristicFactors;

      // AI enhancement if available
      if (lovableKey) {
        try {
          const prompt = `Analyze this social media account for impersonation risk. Return ONLY a JSON object with \\"score\\" (0-100, 0=legitimate, 100=fake) and \\"analysis\\" (one sentence).

Account: @${acct.platform_username} on ${acct.platform}
Display name: ${acct.current_display_name || "none"}
Bio: ${acct.current_bio || "none"}
Followers: ${acct.current_follower_count ?? "unknown"}
Following: ${acct.current_following_count ?? "unknown"}
Posts: ${acct.current_post_count ?? "unknown"}
Platform verified: ${acct.current_verified ? "yes" : "no"}
Profile changes detected: ${acct.profile_changes_count ?? 0}
Associated influencer: ${accountData.influencer_name}
Heuristic risk score: ${heuristicScore}`;

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: "You are an impersonation detection analyst. Evaluate social media accounts and determine if they are legitimate or potential imposters. Return ONLY valid JSON." },
                { role: "user", content: prompt },
              ],
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (typeof parsed.score === "number") {
                // Blend: 60% AI, 40% heuristic
                finalScore = Math.round(parsed.score * 0.6 + heuristicScore * 0.4);
                finalFactors.ai_score = { impact: parsed.score - heuristicScore, detail: parsed.analysis || "AI analysis" };
                aiEnhanced = true;
              }
            }
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
        summary: `Scored ${scored} accounts. ${results.filter(r => r.risk_score > 65).length} flagged as suspicious+`,
        items_processed: scored,
        items_flagged: results.filter(r => r.risk_score > 65).length,
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

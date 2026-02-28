/**
 * agent-reputation-pulse — Generates daily impersonation risk scores per influencer
 * based on active threats, platform response times, follower exposure, and trending patterns.
 *
 * Interval: Every 24 hours at 06:00 UTC (daily digest)
 * Autonomy: Dashboard metric — fully automated, no human action required
 *
 * Computes a 0-100 "Impersonation Risk Score" and A-F grade.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Calculate risk score from various factors */
function calculateRiskScore(factors: {
  activeReports: number;
  criticalReports: number;
  highReports: number;
  pendingTakedowns: number;
  stalledTakedowns: number;
  recentDetections7d: number;
  monitoredAccounts: number;
  deepfakeFlags: number;
  scamLinkFlags: number;
}): { score: number; grade: string; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};

  // Active threat weight (0-30 points)
  breakdown.active_threats = Math.min(30,
    factors.criticalReports * 10 + factors.highReports * 5 + factors.activeReports * 2
  );

  // Takedown effectiveness (0-20 points — high = bad, takedowns are stalling)
  breakdown.takedown_risk = Math.min(20, factors.stalledTakedowns * 8 + factors.pendingTakedowns * 3);

  // Velocity — recent detections trending (0-20 points)
  breakdown.detection_velocity = Math.min(20, factors.recentDetections7d * 3);

  // Deepfake & scam sophistication (0-15 points)
  breakdown.sophistication = Math.min(15, factors.deepfakeFlags * 5 + factors.scamLinkFlags * 4);

  // Coverage gaps (0-15 points — fewer monitored accounts = higher risk)
  breakdown.coverage_gap = factors.monitoredAccounts === 0 ? 15 :
    factors.monitoredAccounts < 3 ? 10 : factors.monitoredAccounts < 5 ? 5 : 0;

  const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));

  const grade = score <= 10 ? "A" : score <= 25 ? "B" : score <= 45 ? "C" :
    score <= 65 ? "D" : score <= 85 ? "E" : "F";

  return { score, grade, breakdown };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));

    const { data: run } = await supabase.from("agent_runs").insert({
      agent_type: "reputation_pulse",
      trigger_type: body.trigger_type || "manual",
      status: "running",
      started_at: new Date().toISOString(),
      input_params: body,
    }).select("id").single();

    // Get all influencer profiles
    let query = supabase.from("influencer_profiles").select("*");
    if (body.influencer_id) query = query.eq("id", body.influencer_id);

    const { data: influencers } = await query;
    let processed = 0, flagged = 0;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const inf of influencers || []) {
      processed++;

      // Gather all metrics in parallel
      const [
        { count: activeReports },
        { count: criticalReports },
        { count: highReports },
        { count: pendingTakedowns },
        { count: stalledTakedowns },
        { count: recentDetections },
        { count: monitoredAccounts },
      ] = await Promise.all([
        supabase.from("impersonation_reports").select("id", { count: "exact", head: true })
          .eq("influencer_id", inf.id).in("status", ["pending", "confirmed"]),
        supabase.from("impersonation_reports").select("id", { count: "exact", head: true })
          .eq("influencer_id", inf.id).eq("severity", "critical").in("status", ["pending", "confirmed"]),
        supabase.from("impersonation_reports").select("id", { count: "exact", head: true })
          .eq("influencer_id", inf.id).eq("severity", "high").in("status", ["pending", "confirmed"]),
        supabase.from("takedown_requests").select("id", { count: "exact", head: true })
          .eq("influencer_id", inf.id).in("status", ["draft", "submitted"]),
        supabase.from("takedown_requests").select("id", { count: "exact", head: true })
          .eq("influencer_id", inf.id).eq("status", "escalated"),
        supabase.from("impersonation_reports").select("id", { count: "exact", head: true })
          .eq("influencer_id", inf.id).gte("created_at", sevenDaysAgo),
        supabase.from("monitored_accounts").select("id", { count: "exact", head: true })
          .eq("influencer_id", inf.id).eq("verified", true),
      ]);

      // Count deepfake + scam flags from AI analysis
      const { data: analysisReports } = await supabase.from("impersonation_reports")
        .select("ai_analysis").eq("influencer_id", inf.id).in("status", ["pending", "confirmed"]);

      let deepfakeFlags = 0, scamLinkFlags = 0;
      for (const r of analysisReports || []) {
        const a = r.ai_analysis as any;
        if (a?.deepfake_probability >= 60) deepfakeFlags++;
        if (a?.scam_links_analyzed && a?.malicious_links?.length > 0) scamLinkFlags++;
      }

      const { score, grade, breakdown } = calculateRiskScore({
        activeReports: activeReports || 0,
        criticalReports: criticalReports || 0,
        highReports: highReports || 0,
        pendingTakedowns: pendingTakedowns || 0,
        stalledTakedowns: stalledTakedowns || 0,
        recentDetections7d: recentDetections || 0,
        monitoredAccounts: monitoredAccounts || 0,
        deepfakeFlags,
        scamLinkFlags,
      });

      // Get previous score for delta
      const { data: prevScore } = await supabase.from("trust_score_history")
        .select("score")
        .eq("brand", inf.display_name)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const delta = prevScore ? score - prevScore.score : 0;
      const alertTriggered = delta >= 15 || score >= 65;

      // Store in trust_score_history
      await supabase.from("trust_score_history").insert({
        brand: inf.display_name,
        score: 100 - score, // Invert: trust_score_history uses trust (100=good), we compute risk
        grade,
        delta: -delta,
        alert_triggered: alertTriggered,
        factors: { risk_score: score, ...breakdown, run_id: run?.id },
      });

      if (alertTriggered) flagged++;
    }

    await supabase.from("agent_runs").update({
      status: "completed", completed_at: new Date().toISOString(),
      items_processed: processed, items_flagged: flagged,
      summary: `Generated reputation pulse for ${processed} influencers. ${flagged} triggered risk alerts.`,
    }).eq("id", run?.id);

    return new Response(JSON.stringify({ success: true, run_id: run?.id, processed, flagged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Reputation Pulse error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

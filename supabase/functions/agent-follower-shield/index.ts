/**
 * agent-follower-shield — Monitors influencer follower ecosystems for accounts
 * that interact with known impersonators, alerting potential victims.
 *
 * Interval: Every 12 hours (scraping follower pages is heavy)
 * Autonomy: Advisory alerts only — informational
 *
 * Uses Firecrawl to scrape impersonator profiles and detect engagement patterns.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_IMPERSONATORS_PER_RUN = 10;
const SCRAPE_DELAY_MS = 3000;

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** AI analysis of impersonator engagement to estimate victim count */
async function analyzeFollowerExposure(profileContent: string, impersonator: string, platform: string, aiKey: string) {
  const prompt = `Analyze this impersonator profile to estimate how many followers/victims may be affected.

Platform: ${platform}
Impersonator: @${impersonator}
Profile Content:
${profileContent.substring(0, 3000)}

Analyze and return JSON:
{
  "estimated_followers": number (best estimate from profile content),
  "engagement_level": "high|medium|low" (based on visible interactions),
  "active_scam_indicators": ["indicator1", "indicator2"],
  "victim_risk_level": "critical|high|medium|low",
  "estimated_at_risk_followers": number,
  "recommendation": "brief action recommendation"
}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }], temperature: 0.1 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const match = (data.choices?.[0]?.message?.content || "").match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const fcKey = Deno.env.get("FIRECRAWL_API_KEY")!;
    const body = await req.json().catch(() => ({}));

    const { data: run } = await supabase.from("agent_runs").insert({
      agent_type: "follower_shield",
      trigger_type: body.trigger_type || "manual",
      status: "running",
      started_at: new Date().toISOString(),
      input_params: body,
    }).select("id").single();

    // Get confirmed impersonation reports with URLs
    const { data: reports } = await supabase.from("impersonation_reports")
      .select("*, influencer_profiles(display_name, brand_name)")
      .in("status", ["confirmed"])
      .in("severity", ["critical", "high"])
      .not("impersonator_url", "is", null)
      .order("similarity_score", { ascending: false })
      .limit(MAX_IMPERSONATORS_PER_RUN);

    let processed = 0, flagged = 0;

    for (const report of reports || []) {
      processed++;
      if (!report.impersonator_url) continue;

      await sleep(SCRAPE_DELAY_MS);

      // Scrape impersonator profile for follower/engagement data
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { "Authorization": `Bearer ${fcKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: report.impersonator_url, formats: ["markdown"], timeout: 15000 }),
      });

      if (!res.ok) continue;
      const scraped = (await res.json()).data;
      if (!scraped?.markdown) continue;

      const analysis = await analyzeFollowerExposure(
        scraped.markdown, report.impersonator_username, report.platform, aiKey
      );

      if (analysis) {
        const existingAnalysis = (report.ai_analysis as any) || {};
        await supabase.from("impersonation_reports").update({
          ai_analysis: {
            ...existingAnalysis,
            follower_shield: {
              estimated_followers: analysis.estimated_followers,
              engagement_level: analysis.engagement_level,
              active_scam_indicators: analysis.active_scam_indicators,
              victim_risk_level: analysis.victim_risk_level,
              estimated_at_risk: analysis.estimated_at_risk_followers,
              recommendation: analysis.recommendation,
              analyzed_at: new Date().toISOString(),
              run_id: run?.id,
            },
          },
        }).eq("id", report.id);

        if (analysis.victim_risk_level === "critical" || analysis.victim_risk_level === "high") {
          flagged++;
        }
      }
    }

    await supabase.from("agent_runs").update({
      status: "completed", completed_at: new Date().toISOString(),
      items_processed: processed, items_flagged: flagged,
      summary: `Analyzed follower exposure for ${processed} impersonators. ${flagged} high-risk profiles identified.`,
    }).eq("id", run?.id);

    return new Response(JSON.stringify({ success: true, run_id: run?.id, processed, flagged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Follower Shield error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

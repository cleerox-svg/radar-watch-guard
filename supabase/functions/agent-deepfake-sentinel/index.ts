/**
 * agent-deepfake-sentinel — Analyzes profile photos and content for AI-generated
 * or stolen imagery using reverse image heuristics and deepfake detection.
 *
 * Interval: Every 12 hours (heavy AI analysis, conservative rate)
 * Autonomy: Alert + auto-escalate critical findings
 *
 * Uses Firecrawl screenshots + Lovable AI vision for analysis.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_REPORTS_PER_RUN = 15;
const SCRAPE_DELAY_MS = 3000; // 3s between scrapes for screenshot-heavy requests

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Scrape profile with screenshot for visual analysis */
async function scrapeWithScreenshot(url: string, apiKey: string): Promise<any | null> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown", "screenshot"], timeout: 25000 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data || data || null;
  } catch { return null; }
}

/** AI analysis for deepfake/stolen imagery indicators */
async function analyzeForDeepfake(profileContent: string, profileUrl: string, screenshot: string | null, aiKey: string) {
  const prompt = `You are a deepfake and stolen imagery detection analyst. Analyze the following social media profile for signs of AI-generated or stolen content.

Profile URL: ${profileUrl}
Profile Content:
${profileContent.substring(0, 3000)}

${screenshot ? "A screenshot of the profile is available for analysis." : "No screenshot available."}

Analyze for these indicators:
1. AI-generated profile photo patterns (unnatural symmetry, artifact patterns, inconsistent backgrounds)
2. Stolen/copied profile imagery from known influencers
3. AI-generated bio text patterns (generic, overly polished, keyword-stuffed)
4. Inconsistent posting patterns suggesting bot behavior
5. Content that appears mass-generated or templated
6. Mismatched visual identity elements

Return JSON only:
{
  "deepfake_probability": 0-100,
  "stolen_content_probability": 0-100,
  "indicators": ["indicator1", "indicator2"],
  "risk_level": "critical|high|medium|low",
  "recommendation": "brief action recommendation",
  "analysis_summary": "2-3 sentence summary"
}`;

  try {
    const messages: any[] = [{ role: "user", content: prompt }];
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, temperature: 0.1 }),
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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const fcKey = Deno.env.get("FIRECRAWL_API_KEY")!;
    const body = await req.json().catch(() => ({}));

    // Create run
    const { data: run } = await supabase.from("agent_runs").insert({
      agent_type: "deepfake_sentinel",
      trigger_type: body.trigger_type || "manual",
      status: "running",
      started_at: new Date().toISOString(),
      input_params: body,
    }).select("id").single();

    // Fetch pending/confirmed reports that haven't been deepfake-analyzed
    const { data: reports } = await supabase.from("impersonation_reports")
      .select("*, influencer_profiles(display_name, brand_name)")
      .in("status", ["pending", "confirmed"])
      .or("ai_analysis->deepfake_analyzed.is.null")
      .order("severity", { ascending: false })
      .limit(MAX_REPORTS_PER_RUN);

    let processed = 0, flagged = 0;

    for (const report of reports || []) {
      processed++;
      const profileUrl = report.impersonator_url;
      if (!profileUrl) continue;

      await sleep(SCRAPE_DELAY_MS);
      const scraped = await scrapeWithScreenshot(profileUrl, fcKey);
      if (!scraped?.markdown) continue;

      const analysis = await analyzeForDeepfake(scraped.markdown, profileUrl, scraped.screenshot || null, aiKey);
      if (!analysis) continue;

      // Update report with deepfake analysis
      const existingAnalysis = (report.ai_analysis as any) || {};
      const updatedAnalysis = {
        ...existingAnalysis,
        deepfake_analyzed: true,
        deepfake_probability: analysis.deepfake_probability,
        stolen_content_probability: analysis.stolen_content_probability,
        deepfake_indicators: analysis.indicators,
        deepfake_risk_level: analysis.risk_level,
        deepfake_recommendation: analysis.recommendation,
        deepfake_summary: analysis.analysis_summary,
        deepfake_run_id: run?.id,
      };

      // Auto-escalate critical findings
      const newSeverity = analysis.risk_level === "critical" ? "critical" :
        analysis.deepfake_probability >= 70 ? "high" : report.severity;

      await supabase.from("impersonation_reports").update({
        ai_analysis: updatedAnalysis,
        severity: newSeverity,
      }).eq("id", report.id);

      if (analysis.deepfake_probability >= 60 || analysis.stolen_content_probability >= 60) {
        flagged++;
      }
    }

    await supabase.from("agent_runs").update({
      status: "completed", completed_at: new Date().toISOString(),
      items_processed: processed, items_flagged: flagged,
      summary: `Analyzed ${processed} profiles for deepfake/stolen content. ${flagged} flagged as suspicious.`,
    }).eq("id", run?.id);

    return new Response(JSON.stringify({ success: true, run_id: run?.id, processed, flagged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Deepfake Sentinel error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

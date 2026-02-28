/**
 * agent-scam-link-detector — Monitors impersonator profiles for malicious links
 * (phishing kits, fake merch stores, crypto scams) and cross-references with
 * Radar's threat intel feeds.
 *
 * Interval: Every 4 hours (moderate scraping load)
 * Autonomy: Auto-flag + notify, human review for takedowns
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PROFILES_PER_RUN = 20;
const SCRAPE_DELAY_MS = 2000;

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Extract URLs from markdown content */
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s\)\]<>"']+/g;
  return [...new Set((text.match(urlRegex) || []))];
}

/** Check extracted URLs against Radar threat database */
async function crossRefWithThreats(urls: string[], supabase: any): Promise<{ url: string; threat_id: string; severity: string }[]> {
  const matches: any[] = [];
  for (const url of urls) {
    try {
      const domain = new URL(url).hostname;
      const { data } = await supabase.from("threats")
        .select("id, severity, attack_type, domain")
        .eq("domain", domain)
        .in("status", ["active", "investigating"])
        .limit(1);
      if (data?.length) {
        matches.push({ url, threat_id: data[0].id, severity: data[0].severity, attack_type: data[0].attack_type });
      }
    } catch { /* invalid URL */ }
  }
  return matches;
}

/** AI analysis for scam indicators in profile links */
async function analyzeLinksForScams(profileContent: string, extractedUrls: string[], profileUrl: string, aiKey: string) {
  const prompt = `Analyze these links found on a suspected impersonator social media profile for scam indicators.

Profile: ${profileUrl}
Links found:
${extractedUrls.slice(0, 20).map((u, i) => `${i + 1}. ${u}`).join("\n")}

Profile content snippet:
${profileContent.substring(0, 1500)}

Classify each link as:
- "phishing" — credential harvesting, fake login pages
- "scam_merch" — fake merchandise or unauthorized branded products
- "crypto_scam" — pump-and-dump, fake giveaways, wallet drainers
- "malware" — malware distribution
- "redirect" — suspicious redirect chains
- "clean" — appears legitimate

Return JSON:
{
  "analyzed_links": [{"url": "...", "classification": "...", "confidence": 0-100, "reason": "..."}],
  "overall_risk": "critical|high|medium|low",
  "scam_summary": "brief summary"
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
      agent_type: "scam_link_detector",
      trigger_type: body.trigger_type || "manual",
      status: "running",
      started_at: new Date().toISOString(),
      input_params: body,
    }).select("id").single();

    // Get confirmed/pending impersonation reports with URLs
    const { data: reports } = await supabase.from("impersonation_reports")
      .select("*")
      .in("status", ["pending", "confirmed"])
      .not("impersonator_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(MAX_PROFILES_PER_RUN);

    let processed = 0, flagged = 0;

    for (const report of reports || []) {
      processed++;
      if (!report.impersonator_url) continue;

      await sleep(SCRAPE_DELAY_MS);

      // Scrape impersonator profile for links
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { "Authorization": `Bearer ${fcKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: report.impersonator_url, formats: ["markdown", "links"], timeout: 15000 }),
      });

      if (!res.ok) continue;
      const scraped = (await res.json()).data;
      if (!scraped) continue;

      const urls = [...(scraped.links || []), ...extractUrls(scraped.markdown || "")];
      if (urls.length === 0) continue;

      // Cross-reference with threat DB
      const threatMatches = await crossRefWithThreats(urls, supabase);

      // AI analysis
      const linkAnalysis = await analyzeLinksForScams(scraped.markdown || "", urls, report.impersonator_url, aiKey);

      const maliciousLinks = linkAnalysis?.analyzed_links?.filter((l: any) => l.classification !== "clean" && l.confidence >= 60) || [];

      if (maliciousLinks.length > 0 || threatMatches.length > 0) {
        flagged++;
        const existingAnalysis = (report.ai_analysis as any) || {};
        await supabase.from("impersonation_reports").update({
          ai_analysis: {
            ...existingAnalysis,
            scam_links_analyzed: true,
            malicious_links: maliciousLinks,
            threat_cross_refs: threatMatches,
            scam_risk: linkAnalysis?.overall_risk || "unknown",
            scam_summary: linkAnalysis?.scam_summary,
            scam_run_id: run?.id,
          },
          severity: (threatMatches.length > 0 || linkAnalysis?.overall_risk === "critical") ? "critical" :
            linkAnalysis?.overall_risk === "high" ? "high" : report.severity,
        }).eq("id", report.id);
      }
    }

    await supabase.from("agent_runs").update({
      status: "completed", completed_at: new Date().toISOString(),
      items_processed: processed, items_flagged: flagged,
      summary: `Scanned ${processed} impersonator profiles for scam links. ${flagged} profiles with malicious links detected.`,
    }).eq("id", run?.id);

    return new Response(JSON.stringify({ success: true, run_id: run?.id, processed, flagged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scam Link Detector error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

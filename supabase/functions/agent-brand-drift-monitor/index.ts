/**
 * agent-brand-drift-monitor — Tracks unauthorized use of influencer brand assets
 * (logos, catchphrases, merch designs) across web and social platforms using
 * Firecrawl web search + AI content fingerprinting.
 *
 * Interval: Every 24 hours (heavy search + crawl operations)
 * Autonomy: Alert + evidence capture
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_INFLUENCERS_PER_RUN = 5;
const SEARCH_DELAY_MS = 3000;
const MAX_SEARCHES_PER_INFLUENCER = 3;

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

/** Search for unauthorized brand usage via Firecrawl */
async function searchBrandMisuse(query: string, fcKey: string): Promise<any[]> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: { "Authorization": `Bearer ${fcKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit: 10, scrapeOptions: { formats: ["markdown"] } }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch { return []; }
}

/** AI analysis to determine if search result represents unauthorized brand usage */
async function analyzeBrandViolation(result: any, influencer: any, aiKey: string) {
  const prompt = `Determine if this web page represents unauthorized use of an influencer's brand.

INFLUENCER: ${influencer.display_name} (Brand: ${influencer.brand_name || influencer.display_name})
Website: ${influencer.website_url || "N/A"}

FOUND PAGE:
URL: ${result.url}
Title: ${result.title || "N/A"}
Content: ${(result.markdown || result.description || "").substring(0, 2000)}

Is this unauthorized brand usage? Consider:
- Fake merchandise stores
- Unauthorized use of brand name/catchphrases
- Fake endorsements or promotions
- Counterfeit products using brand identity
- Fan pages are OK (not violations)
- Official/authorized content is OK

Return JSON:
{
  "is_violation": true/false,
  "violation_type": "fake_merch|brand_theft|fake_endorsement|counterfeit|impersonation|none",
  "confidence": 0-100,
  "severity": "critical|high|medium|low",
  "details": "brief explanation"
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const fcKey = Deno.env.get("FIRECRAWL_API_KEY")!;
    const body = await req.json().catch(() => ({}));

    const { data: run } = await supabase.from("agent_runs").insert({
      agent_type: "brand_drift_monitor",
      trigger_type: body.trigger_type || "manual",
      status: "running",
      started_at: new Date().toISOString(),
      input_params: body,
    }).select("id").single();

    // Get influencer profiles to monitor
    let query = supabase.from("influencer_profiles")
      .select("*")
      .eq("onboarding_completed", true)
      .limit(MAX_INFLUENCERS_PER_RUN);
    if (body.influencer_id) query = query.eq("id", body.influencer_id);

    const { data: influencers } = await query;
    let processed = 0, flagged = 0;

    for (const inf of influencers || []) {
      processed++;
      const brandName = inf.brand_name || inf.display_name;

      // Generate search queries for brand misuse
      const searches = [
        `"${brandName}" merch store -site:${inf.website_url ? new URL(inf.website_url).hostname : "official.com"}`,
        `"${brandName}" giveaway crypto promotion`,
        `"${inf.display_name}" fake endorsement scam`,
      ].slice(0, MAX_SEARCHES_PER_INFLUENCER);

      for (const searchQuery of searches) {
        await sleep(SEARCH_DELAY_MS);
        const results = await searchBrandMisuse(searchQuery, fcKey);

        for (const result of results) {
          const analysis = await analyzeBrandViolation(result, inf, aiKey);

          if (analysis?.is_violation && analysis.confidence >= 60) {
            flagged++;

            // Store as evidence capture
            await supabase.from("evidence_captures").insert({
              domain: new URL(result.url).hostname,
              capture_type: "brand_drift",
              status: "captured",
              evidence_data: {
                url: result.url,
                title: result.title,
                content_snippet: (result.markdown || "").substring(0, 500),
                violation_type: analysis.violation_type,
                confidence: analysis.confidence,
                severity: analysis.severity,
                details: analysis.details,
              },
              chain_of_custody: [{
                action: "brand_drift_detected",
                timestamp: new Date().toISOString(),
                agent: "brand_drift_monitor",
                run_id: run?.id,
              }],
              tags: ["brand_drift", analysis.violation_type, inf.display_name],
            });
          }
        }
      }
    }

    await supabase.from("agent_runs").update({
      status: "completed", completed_at: new Date().toISOString(),
      items_processed: processed, items_flagged: flagged,
      summary: `Monitored brand drift for ${processed} influencers. ${flagged} unauthorized brand uses detected.`,
    }).eq("id", run?.id);

    return new Response(JSON.stringify({ success: true, run_id: run?.id, processed, flagged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Brand Drift Monitor error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

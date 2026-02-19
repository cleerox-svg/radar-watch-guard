/**
 * converged-intel — Converged Intelligence Engine.
 *
 * Correlates external threat feeds (threats table) with internal telemetry
 * (DMARC failures from email_auth_reports, ATO events) to identify
 * active weaponization and produce actionable correlation alerts.
 *
 * Uses Lovable AI to synthesize findings into analyst-ready intelligence.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch last 7 days of data in parallel
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [threatsRes, dmarcRes, atoRes, newsRes, socialRes, breachRes] = await Promise.all([
      sb.from("threats").select("*").gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }).limit(200),
      sb.from("email_auth_reports").select("*").gte("created_at", sevenDaysAgo).limit(200),
      sb.from("ato_events").select("*").gte("created_at", sevenDaysAgo).limit(100),
      sb.from("threat_news").select("*").gte("created_at", sevenDaysAgo).limit(50),
      sb.from("social_iocs").select("*").gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }).limit(300),
      sb.from("breach_checks").select("*").gte("created_at", sevenDaysAgo).limit(100),
    ]);

    const threats = threatsRes.data || [];
    const dmarcReports = dmarcRes.data || [];
    const atoEvents = atoRes.data || [];
    const news = newsRes.data || [];
    const socialIocs = socialRes.data || [];
    const breachChecks = breachRes.data || [];

    // ── Local Correlation Logic ───────────────────────────────────────
    // Find DMARC failures
    const dmarcFailures = dmarcReports.filter(
      (r) => !r.dmarc_aligned || !r.spf_pass || !r.dkim_pass
    );

    // Extract brands targeted in threats
    const threatBrands = [...new Set(threats.map((t) => t.brand?.toLowerCase()).filter(Boolean))];
    const threatDomains = [...new Set(threats.map((t) => t.domain?.toLowerCase()).filter(Boolean))];

    // Cross-reference: DMARC failures where source matches a known threat brand
    const correlatedDmarcThreats = dmarcFailures.filter((d) =>
      threatBrands.some((brand) => d.source_name?.toLowerCase().includes(brand as string))
    );

    // Cross-reference: ATO events with IPs matching threat infrastructure
    const threatIPs = new Set(threats.map((t) => t.ip_address).filter(Boolean));
    const correlatedAtoThreats = atoEvents.filter(
      (a) => threatIPs.has(a.ip_from) || threatIPs.has(a.ip_to)
    );

    // High-severity active threats
    const activeHighThreats = threats.filter(
      (t) => t.status === "active" && (t.severity === "critical" || t.severity === "high")
    );

    // ── Social IOC Correlations ───────────────────────────────────────
    // IOC domains/IPs that match known threat infrastructure
    const socialDomains = socialIocs.filter((s) => s.ioc_type === "domain" || s.ioc_type === "url");
    const socialIPs = socialIocs.filter((s) => s.ioc_type === "ip");
    const socialHashes = socialIocs.filter((s) => s.ioc_type === "sha256" || s.ioc_type === "md5");

    const correlatedSocialThreats = socialDomains.filter((s) =>
      threatDomains.some((d) => s.ioc_value?.toLowerCase().includes(d as string))
    );
    const correlatedSocialIPs = socialIPs.filter((s) => threatIPs.has(s.ioc_value));
    const socialTags = socialIocs.flatMap((s) => s.tags || []);
    const tagCounts: Record<string, number> = {};
    socialTags.forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    const trendingTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // ── Breach Correlations ───────────────────────────────────────────
    const highRiskBreaches = breachChecks.filter((b) => b.risk_level === "high" || b.risk_level === "critical");
    const breachedDomains = breachChecks.filter((b) => b.check_type === "domain");
    const correlatedBreachBrands = breachedDomains.filter((b) =>
      threatBrands.some((brand) => b.check_value?.toLowerCase().includes(brand as string))
    );

    // Build correlation summary
    const correlations = {
      total_threats_7d: threats.length,
      active_high_threats: activeHighThreats.length,
      dmarc_failures_7d: dmarcFailures.length,
      ato_events_7d: atoEvents.length,
      correlated_dmarc_threats: correlatedDmarcThreats.length,
      correlated_ato_threats: correlatedAtoThreats.length,
      weaponized_domains: threatDomains.slice(0, 20),
      targeted_brands: threatBrands.slice(0, 15),
      kev_alerts: news.filter((n) => n.severity === "critical").length,
      // New social + breach correlations
      social_iocs_7d: socialIocs.length,
      social_domains: socialDomains.length,
      social_ips: socialIPs.length,
      social_hashes: socialHashes.length,
      correlated_social_threats: correlatedSocialThreats.length,
      correlated_social_ips: correlatedSocialIPs.length,
      trending_tags: trendingTags,
      breach_checks_7d: breachChecks.length,
      high_risk_breaches: highRiskBreaches.length,
      correlated_breach_brands: correlatedBreachBrands.length,
    };

    // ── AI Synthesis ──────────────────────────────────────────────────
    let aiAnalysis = null;
    if (lovableKey) {
      const prompt = `You are a cybersecurity convergence analyst. Analyze these correlation findings and provide actionable intelligence.

## Correlation Data (Last 7 Days)
- External threats detected: ${correlations.total_threats_7d}
- Active high/critical threats: ${correlations.active_high_threats}
- DMARC authentication failures: ${correlations.dmarc_failures_7d}
- Account takeover events: ${correlations.ato_events_7d}
- DMARC failures correlated with known threat actors: ${correlations.correlated_dmarc_threats}
- ATO events linked to threat infrastructure: ${correlations.correlated_ato_threats}
- Known exploited vulnerabilities (critical): ${correlations.kev_alerts}

## Targeted Brands: ${correlations.targeted_brands.join(", ") || "None detected"}

## Active Weaponized Domains (sample): ${correlations.weaponized_domains.slice(0, 10).join(", ") || "None detected"}

## Sample Threat Details:
${activeHighThreats.slice(0, 5).map((t) => `- ${t.brand} | ${t.domain} | ${t.attack_type} | ${t.severity}`).join("\n")}

## Sample DMARC Failures:
${dmarcFailures.slice(0, 5).map((d) => `- ${d.source_name} | SPF:${d.spf_pass} DKIM:${d.dkim_pass} DMARC:${d.dmarc_aligned} | Vol:${d.volume}`).join("\n")}

## Sample ATO Events:
${atoEvents.slice(0, 5).map((a) => `- ${a.user_email} | ${a.event_type} | From:${a.location_from} To:${a.location_to} | Risk:${a.risk_score}`).join("\n")}

## Social Media IOCs (last 7 days):
- Total IOCs ingested: ${correlations.social_iocs_7d}
- Domains: ${correlations.social_domains}, IPs: ${correlations.social_ips}, Hashes: ${correlations.social_hashes}
- IOC domains matching threat infrastructure: ${correlations.correlated_social_threats}
- IOC IPs matching threat infrastructure: ${correlations.correlated_social_ips}
- Trending threat tags: ${trendingTags.map(([t, c]) => `${t}(${c})`).join(", ") || "None"}

## Sample Social IOCs:
${socialIocs.slice(0, 8).map((s) => `- [${s.ioc_type}] ${s.ioc_value} | ${s.source} | Tags: ${(s.tags || []).join(",")}`).join("\n")}

## Breach/Dark Web Intelligence:
- Total breach checks: ${correlations.breach_checks_7d}
- High/critical risk findings: ${correlations.high_risk_breaches}
- Breached domains matching targeted brands: ${correlations.correlated_breach_brands}

## Sample Breach Checks:
${highRiskBreaches.slice(0, 5).map((b) => `- ${b.check_type}:${b.check_value} | Risk:${b.risk_level} | Breaches:${b.breaches_found}`).join("\n")}

Return JSON:
{
  "convergence_score": <0-100 risk score>,
  "convergence_grade": "<A-F>",
  "active_campaigns": [{"name":"...", "stage":"preparation|weaponization|delivery|exploitation", "confidence":"high|medium|low", "indicators":["..."], "recommended_actions":["..."]}],
  "gap_analysis": {"blind_spots":["..."], "coverage_strengths":["..."]},
  "auto_actions": [{"action":"...", "target":"...", "urgency":"immediate|short_term|monitor", "rationale":"..."}],
  "executive_summary": "2-3 sentence overview"
}`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are a converged threat intelligence analyst. Return only valid JSON." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const raw = aiData.choices?.[0]?.message?.content || "";
          const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          aiAnalysis = JSON.parse(cleaned);
        } else {
          const errText = await aiResp.text();
          console.error("AI gateway error:", aiResp.status, errText);
        }
      } catch (e) {
        console.error("AI synthesis error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        correlations,
        ai_analysis: aiAnalysis,
        raw_data: {
          sample_threats: activeHighThreats.slice(0, 10),
          sample_dmarc_failures: dmarcFailures.slice(0, 10),
          sample_ato_events: atoEvents.slice(0, 5),
          sample_social_iocs: socialIocs.slice(0, 10),
          sample_breaches: highRiskBreaches.slice(0, 5),
        },
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("converged-intel error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Analysis failed" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

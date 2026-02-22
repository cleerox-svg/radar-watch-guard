/**
 * converged-intel — Converged Intelligence Engine (v2).
 *
 * Correlates ALL data sources across the platform:
 * - threats, social_iocs, threat_news, email_auth_reports
 * - ato_events, breach_checks, tor_exit_nodes, spam_trap_hits
 * - erasure_actions, investigation_tickets
 *
 * Produces cross-correlation alerts and AI-synthesized intelligence.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Extract correlations from raw data */
function computeCorrelations(data: {
  threats: any[]; dmarcReports: any[]; atoEvents: any[];
  news: any[]; socialIocs: any[]; breachChecks: any[];
  torNodes: any[]; spamTraps: any[];
  erasureActions: any[]; tickets: any[];
}) {
  const { threats, dmarcReports, atoEvents, news, socialIocs, breachChecks, torNodes, spamTraps, erasureActions, tickets } = data;

  // Extract key indicators
  const threatBrands = [...new Set(threats.map(t => t.brand?.toLowerCase()).filter(Boolean))];
  const threatDomains = [...new Set(threats.map(t => t.domain?.toLowerCase()).filter(Boolean))];
  const threatIPs = new Set(threats.map(t => t.ip_address).filter(Boolean));

  // DMARC failures
  const dmarcFailures = dmarcReports.filter(r => !r.dmarc_aligned || !r.spf_pass || !r.dkim_pass);
  const correlatedDmarcThreats = dmarcFailures.filter(d =>
    threatBrands.some(brand => d.source_name?.toLowerCase().includes(brand as string))
  );

  // ATO ↔ Threat IP
  const correlatedAtoThreats = atoEvents.filter(a => threatIPs.has(a.ip_from) || threatIPs.has(a.ip_to));

  // ATO ↔ Tor exit nodes
  const torIPSet = new Set(torNodes.map(n => n.ip_address));
  const atoViaTor = atoEvents.filter(a => torIPSet.has(a.ip_from) || torIPSet.has(a.ip_to));

  // Social IOC correlations
  const socialDomains = socialIocs.filter(s => s.ioc_type === "domain" || s.ioc_type === "url");
  const socialIPs = socialIocs.filter(s => s.ioc_type === "ip");
  const socialHashes = socialIocs.filter(s => s.ioc_type === "sha256" || s.ioc_type === "md5");
  const correlatedSocialThreats = socialDomains.filter(s =>
    threatDomains.some(d => s.ioc_value?.toLowerCase().includes(d as string))
  );
  const correlatedSocialIPs = socialIPs.filter(s => threatIPs.has(s.ioc_value));
  const socialViaTor = socialIPs.filter(s => torIPSet.has(s.ioc_value));

  // Social IOC tags
  const tagCounts: Record<string, number> = {};
  socialIocs.flatMap(s => s.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
  const trendingTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // Breach correlations
  const highRiskBreaches = breachChecks.filter(b => b.risk_level === "high" || b.risk_level === "critical");
  const breachedDomains = breachChecks.filter(b => b.check_type === "domain");
  const correlatedBreachBrands = breachedDomains.filter(b =>
    threatBrands.some(brand => b.check_value?.toLowerCase().includes(brand as string))
  );

  // ── NEW: Spam trap correlations ───
  const spamDomains = spamTraps.map(s => s.sender_domain?.toLowerCase()).filter(Boolean);
  const spamIPs = spamTraps.map(s => s.sender_ip).filter(Boolean);
  const spamBrands = spamTraps.map(s => s.brand_mentioned?.toLowerCase()).filter(Boolean);

  const spamMatchingThreats = spamDomains.filter(d =>
    threatDomains.some(td => d.includes(td as string) || (td as string).includes(d))
  );
  const spamMatchingTor = spamIPs.filter(ip => torIPSet.has(ip));
  const spamMatchingBrands = spamBrands.filter(b =>
    threatBrands.some(tb => b.includes(tb as string))
  );

  // Spam trap ↔ DMARC: senders failing both
  const dmarcFailSources = new Set(dmarcFailures.map(d => d.source_name?.toLowerCase()).filter(Boolean));
  const spamDmarcOverlap = spamDomains.filter(d => dmarcFailSources.has(d));

  // ── NEW: Tor ↔ Threat infrastructure ───
  const torMatchingThreats = torNodes.filter(n => threatIPs.has(n.ip_address));

  // Active high threats
  const activeHighThreats = threats.filter(t => t.status === "active" && (t.severity === "critical" || t.severity === "high"));

  // ── Operational status ───
  const openTickets = tickets.filter(t => t.status === "open" || t.status === "in_progress");
  const pendingErasures = erasureActions.filter(e => e.status === "pending" || e.status === "in_progress");

  return {
    total_threats_7d: threats.length,
    active_high_threats: activeHighThreats.length,
    dmarc_failures_7d: dmarcFailures.length,
    ato_events_7d: atoEvents.length,
    correlated_dmarc_threats: correlatedDmarcThreats.length,
    correlated_ato_threats: correlatedAtoThreats.length,
    weaponized_domains: threatDomains.slice(0, 20),
    targeted_brands: threatBrands.slice(0, 15),
    kev_alerts: news.filter(n => n.severity === "critical").length,
    // Social
    social_iocs_7d: socialIocs.length,
    social_domains: socialDomains.length,
    social_ips: socialIPs.length,
    social_hashes: socialHashes.length,
    correlated_social_threats: correlatedSocialThreats.length,
    correlated_social_ips: correlatedSocialIPs.length,
    social_via_tor: socialViaTor.length,
    trending_tags: trendingTags,
    // Breaches
    breach_checks_7d: breachChecks.length,
    high_risk_breaches: highRiskBreaches.length,
    correlated_breach_brands: correlatedBreachBrands.length,
    // Spam traps (NEW)
    spam_traps_7d: spamTraps.length,
    spam_matching_threats: spamMatchingThreats.length,
    spam_matching_tor: spamMatchingTor.length,
    spam_matching_brands: spamMatchingBrands.length,
    spam_dmarc_overlap: spamDmarcOverlap.length,
    // Tor (NEW)
    tor_nodes_tracked: torNodes.length,
    tor_matching_threats: torMatchingThreats.length,
    ato_via_tor: atoViaTor.length,
    // Operational (NEW)
    open_investigations: openTickets.length,
    pending_erasures: pendingErasures.length,
    // Raw for AI
    _activeHighThreats: activeHighThreats,
    _dmarcFailures: dmarcFailures,
    _spamMatchingThreats: spamMatchingThreats,
    _spamDmarcOverlap: spamDmarcOverlap,
    _torMatchingThreats: torMatchingThreats,
    _atoViaTor: atoViaTor,
    _correlatedBreachBrands: correlatedBreachBrands,
  };
}

/** Build AI prompt from correlations */
function buildPrompt(corr: ReturnType<typeof computeCorrelations>, data: any) {
  const { threats, atoEvents, dmarcReports, socialIocs, spamTraps, torNodes, breachChecks } = data;
  const ah = corr._activeHighThreats || [];

  return `You are a cybersecurity convergence analyst. Analyze these FULL cross-correlation findings from 10+ data sources and provide actionable intelligence.

## Correlation Data (Last 7 Days)
- External threats: ${corr.total_threats_7d} | Active high/critical: ${corr.active_high_threats}
- DMARC failures: ${corr.dmarc_failures_7d} | Correlated w/ threat actors: ${corr.correlated_dmarc_threats}
- ATO events: ${corr.ato_events_7d} | Linked to threat infra: ${corr.correlated_ato_threats}
- Critical KEVs: ${corr.kev_alerts}
- Social IOCs: ${corr.social_iocs_7d} (${corr.social_domains} domains, ${corr.social_ips} IPs, ${corr.social_hashes} hashes)
- Social↔Threat: ${corr.correlated_social_threats} domain matches, ${corr.correlated_social_ips} IP matches
- Social via Tor: ${corr.social_via_tor}
- Breach checks: ${corr.breach_checks_7d} | High risk: ${corr.high_risk_breaches} | Brand matches: ${corr.correlated_breach_brands}
- Spam traps: ${corr.spam_traps_7d} | Matching threats: ${corr.spam_matching_threats} | Via Tor: ${corr.spam_matching_tor} | Brand targeting: ${corr.spam_matching_brands} | DMARC overlap: ${corr.spam_dmarc_overlap}
- Tor exit nodes: ${corr.tor_nodes_tracked} | In threat infra: ${corr.tor_matching_threats} | Used in ATO: ${corr.ato_via_tor}
- Open investigations: ${corr.open_investigations} | Pending erasures: ${corr.pending_erasures}

## Targeted Brands: ${corr.targeted_brands.join(", ") || "None"}
## Trending Tags: ${corr.trending_tags.map(([t, c]) => `${t}(${c})`).join(", ") || "None"}

## Sample Active Threats:
${ah.slice(0, 5).map((t: any) => `- ${t.brand} | ${t.domain} | ${t.attack_type} | ${t.severity}`).join("\n")}

## Sample DMARC Failures:
${(corr._dmarcFailures || []).slice(0, 5).map((d: any) => `- ${d.source_name} | SPF:${d.spf_pass} DKIM:${d.dkim_pass} DMARC:${d.dmarc_aligned} | Vol:${d.volume}`).join("\n")}

## Sample ATO Events:
${atoEvents.slice(0, 5).map((a: any) => `- ${a.user_email} | ${a.event_type} | From:${a.location_from} To:${a.location_to} | Risk:${a.risk_score}`).join("\n")}

## Sample Spam Trap Hits:
${spamTraps.slice(0, 5).map((s: any) => `- ${s.sender_domain} | ${s.category} | Brand:${s.brand_mentioned || "none"} | SPF:${s.spf_pass} DKIM:${s.dkim_pass} | Conf:${s.confidence}`).join("\n")}

## Key Cross-Correlations Found:
${corr.spam_matching_threats > 0 ? `- ⚠️ ${corr.spam_matching_threats} spam trap sender domains MATCH known threat domains` : ""}
${corr.spam_dmarc_overlap > 0 ? `- ⚠️ ${corr.spam_dmarc_overlap} spam trap senders ALSO failing DMARC authentication` : ""}
${corr.ato_via_tor > 0 ? `- ⚠️ ${corr.ato_via_tor} ATO events originating from Tor exit nodes` : ""}
${corr.tor_matching_threats > 0 ? `- ⚠️ ${corr.tor_matching_threats} Tor exit nodes hosting known threat infrastructure` : ""}
${corr.correlated_breach_brands > 0 ? `- ⚠️ ${corr.correlated_breach_brands} breached domains match targeted brands` : ""}

Return JSON:
{
  "convergence_score": <0-100 risk score>,
  "convergence_grade": "<A-F>",
  "active_campaigns": [{"name":"...", "stage":"preparation|weaponization|delivery|exploitation", "confidence":"high|medium|low", "indicators":["..."], "recommended_actions":["..."]}],
  "correlation_alerts": [{"title":"...", "severity":"critical|high|medium|low", "data_sources":["threats","spam_traps","dmarc",...], "evidence":["point1","point2",...], "impact":"...", "remediation_options":["option1","option2",...], "confidence":"high|medium|low"}],
  "gap_analysis": {"blind_spots":["..."], "coverage_strengths":["..."]},
  "auto_actions": [{"action":"...", "target":"...", "urgency":"immediate|short_term|monitor", "rationale":"..."}],
  "executive_summary": "2-3 sentence overview"
}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const sb = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const autoCreateTickets = body.auto_create_tickets === true;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch ALL data sources in parallel
    const [threatsRes, dmarcRes, atoRes, newsRes, socialRes, breachRes, torRes, spamRes, erasureRes, ticketsRes] = await Promise.all([
      sb.from("threats").select("*").gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }).limit(200),
      sb.from("email_auth_reports").select("*").gte("created_at", sevenDaysAgo).limit(200),
      sb.from("ato_events").select("*").gte("created_at", sevenDaysAgo).limit(100),
      sb.from("threat_news").select("*").gte("created_at", sevenDaysAgo).limit(50),
      sb.from("social_iocs").select("*").gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }).limit(300),
      sb.from("breach_checks").select("*").gte("created_at", sevenDaysAgo).limit(100),
      sb.from("tor_exit_nodes").select("*").order("last_seen", { ascending: false }).limit(500),
      sb.from("spam_trap_hits").select("*").gte("received_at", sevenDaysAgo).order("received_at", { ascending: false }).limit(200),
      sb.from("erasure_actions").select("id, status, target, type, action").limit(50),
      sb.from("investigation_tickets").select("id, ticket_id, status, severity, priority, source_type, tags").limit(100),
    ]);

    const rawData = {
      threats: threatsRes.data || [],
      dmarcReports: dmarcRes.data || [],
      atoEvents: atoRes.data || [],
      news: newsRes.data || [],
      socialIocs: socialRes.data || [],
      breachChecks: breachRes.data || [],
      torNodes: torRes.data || [],
      spamTraps: spamRes.data || [],
      erasureActions: erasureRes.data || [],
      tickets: ticketsRes.data || [],
    };

    const correlations = computeCorrelations(rawData);

    // Strip internal fields before returning
    const { _activeHighThreats, _dmarcFailures, _spamMatchingThreats, _spamDmarcOverlap, _torMatchingThreats, _atoViaTor, _correlatedBreachBrands, ...publicCorrelations } = correlations;

    // ── AI Synthesis ──
    let aiAnalysis = null;
    if (lovableKey) {
      try {
        const prompt = buildPrompt(correlations, rawData);
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
          console.error("AI gateway error:", aiResp.status, await aiResp.text());
        }
      } catch (e) {
        console.error("AI synthesis error:", e);
      }
    }

    // ── Auto-create correlation alert tickets ──
    let ticketsCreated = 0;
    if (autoCreateTickets && aiAnalysis?.correlation_alerts?.length > 0) {
      for (const alert of aiAnalysis.correlation_alerts) {
        try {
          const description = [
            `**Correlation Alert — ${alert.confidence?.toUpperCase() || "MEDIUM"} Confidence**\n`,
            `**Impact:** ${alert.impact || "See evidence below"}`,
            `\n**Data Sources:** ${(alert.data_sources || []).join(", ")}`,
            `\n**Evidence:**`,
            ...(alert.evidence || []).map((e: string) => `• ${e}`),
            `\n**Remediation Options:**`,
            ...(alert.remediation_options || []).map((r: string) => `• ${r}`),
            `\n**AI Convergence Score:** ${aiAnalysis.convergence_score}/100 (Grade: ${aiAnalysis.convergence_grade})`,
            `\n---\n_Auto-generated by Converged Intelligence Engine at ${new Date().toISOString()}_`,
          ].join("\n");

          const { error } = await sb.from("investigation_tickets").insert({
            title: `[CORRELATION] ${alert.title}`,
            description,
            severity: alert.severity || "medium",
            priority: alert.severity === "critical" ? "critical" : alert.severity === "high" ? "high" : "medium",
            source_type: "correlation_alert",
            source_id: "00000000-0000-0000-0000-000000000000",
            ticket_id: "",
            tags: ["correlation-alert", "auto-generated", ...(alert.data_sources || [])],
            status: "open",
          });
          if (!error) ticketsCreated++;
        } catch (e) {
          console.error("Failed to create correlation ticket:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({
        correlations: publicCorrelations,
        ai_analysis: aiAnalysis,
        tickets_created: ticketsCreated,
        raw_data: {
          sample_threats: (correlations._activeHighThreats || []).slice(0, 10),
          sample_dmarc_failures: (correlations._dmarcFailures || []).slice(0, 10),
          sample_ato_events: rawData.atoEvents.slice(0, 5),
          sample_social_iocs: rawData.socialIocs.slice(0, 10),
          sample_breaches: rawData.breachChecks.filter((b: any) => b.risk_level === "high" || b.risk_level === "critical").slice(0, 5),
          sample_spam_traps: rawData.spamTraps.slice(0, 5),
          sample_tor_nodes: rawData.torNodes.slice(0, 10),
        },
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("converged-intel error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Analysis failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

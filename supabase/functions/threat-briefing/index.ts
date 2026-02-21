/**
 * threat-briefing — Supabase Edge Function
 *
 * Queries ALL feed data (threats, threat_news, social_iocs, ato_events,
 * breach_checks, tor_exit_nodes, erasure_actions, attack_metrics) and sends
 * to AI for a comprehensive intelligence briefing. Excludes spam_trap data.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── Parallel data fetching across all feeds (except spam_trap) ───
    const [
      { data: threats },
      { data: news },
      { data: metrics },
      { data: socialIocs },
      { data: atoEvents },
      { data: breachChecks },
      { data: torNodes },
      { data: erasureActions },
      { data: ingestionJobs },
    ] = await Promise.all([
      supabase.from('threats')
        .select('brand, domain, attack_type, severity, status, source, country, confidence, first_seen, last_seen, ip_address, asn, org_name')
        .order('last_seen', { ascending: false }).limit(150),
      supabase.from('threat_news')
        .select('title, severity, source, cve_id, vendor, product, date_published, metadata, description')
        .order('date_published', { ascending: false }).limit(30),
      supabase.from('attack_metrics')
        .select('metric_name, metric_value, category, country, recorded_at')
        .order('recorded_at', { ascending: false }).limit(30),
      supabase.from('social_iocs')
        .select('ioc_type, ioc_value, source, confidence, tags, date_shared, source_user')
        .order('date_shared', { ascending: false }).limit(50),
      supabase.from('ato_events')
        .select('event_type, user_email, risk_score, location_from, location_to, detected_at, resolved')
        .order('detected_at', { ascending: false }).limit(20),
      supabase.from('breach_checks')
        .select('check_type, check_value, breaches_found, risk_level, breach_names, last_checked')
        .order('last_checked', { ascending: false }).limit(20),
      supabase.from('tor_exit_nodes')
        .select('ip_address, last_seen')
        .order('last_seen', { ascending: false }).limit(50),
      supabase.from('erasure_actions')
        .select('action, provider, target, status, type, created_at, completed_at')
        .order('created_at', { ascending: false }).limit(15),
      supabase.from('ingestion_jobs')
        .select('feed_source, status, records_processed, completed_at, error_message')
        .order('created_at', { ascending: false }).limit(30),
    ]);

    // ─── Build structured summaries for each data source ───
    const threatSummary = (threats || []).map(t =>
      `${t.severity} | ${t.brand} | ${t.domain} | ${t.attack_type} | ${t.source} | ${t.country || 'N/A'} | conf:${t.confidence}% | ${t.last_seen}`
    ).join('\n');

    const newsSummary = (news || []).map(n =>
      `${n.severity} | ${n.source} | ${n.cve_id || 'N/A'} | ${n.vendor || 'N/A'} | ${n.product || 'N/A'} | ${n.title}`
    ).join('\n');

    const metricsSummary = (metrics || []).map(m =>
      `${m.metric_name}: ${m.metric_value} (${m.category || 'N/A'}, ${m.country || 'global'})`
    ).join('\n');

    const socialSummary = (socialIocs || []).map(s =>
      `[${s.confidence}] ${s.ioc_type}: ${s.ioc_value} | tags: ${(s.tags || []).join(',')} | ${s.source} @${s.source_user || 'anon'} | ${s.date_shared}`
    ).join('\n');

    const atoSummary = (atoEvents || []).map(a =>
      `${a.event_type} | ${a.user_email} | risk:${a.risk_score} | ${a.location_from}→${a.location_to} | ${a.resolved ? 'RESOLVED' : 'OPEN'} | ${a.detected_at}`
    ).join('\n');

    const breachSummary = (breachChecks || []).map(b =>
      `${b.check_type}: ${b.check_value} | risk:${b.risk_level} | ${b.breaches_found} breaches | ${(b.breach_names || []).slice(0, 3).join(',')} | ${b.last_checked}`
    ).join('\n');

    const torSummary = `${(torNodes || []).length} active Tor exit nodes tracked`;

    const erasureSummary = (erasureActions || []).map(e =>
      `${e.action} | ${e.provider} → ${e.target} | status:${e.status} | type:${e.type}`
    ).join('\n');

    // Feed health summary
    const feedHealth = (ingestionJobs || []).reduce((acc: Record<string, { status: string; records: number; at: string }>, j: any) => {
      if (!acc[j.feed_source]) {
        acc[j.feed_source] = { status: j.status, records: j.records_processed || 0, at: j.completed_at || '' };
      }
      return acc;
    }, {});
    const feedHealthSummary = Object.entries(feedHealth).map(([src, info]: [string, any]) =>
      `${src}: ${info.status} (${info.records} records, last: ${info.at || 'never'})`
    ).join('\n');

    const systemPrompt = `You are a senior threat intelligence analyst for LRX Radar, a global phishing defense platform. Analyze the provided multi-source threat data and produce a structured intelligence briefing.

Your analysis must be data-driven, referencing specific numbers, domains, brands, CVEs, IOCs, and feed sources. Cross-correlate across data sources to identify patterns. Be direct and actionable.

Format your response as JSON matching this exact structure:
{
  "executive_summary": "2-3 sentence overview of the current threat landscape across all feeds",
  "campaigns": [
    {
      "name": "Campaign name",
      "description": "What this campaign involves",
      "domains_count": number,
      "brands_targeted": ["brand1", "brand2"],
      "severity": "critical|high|medium",
      "sources_correlated": ["feed1", "feed2"],
      "recommendation": "Specific action to take"
    }
  ],
  "top_risks": [
    {
      "title": "Risk title",
      "detail": "Why this is a risk, referencing specific data",
      "priority": "immediate|short_term|monitor",
      "action": "What to do",
      "data_sources": ["which feeds contributed"]
    }
  ],
  "trends": [
    {
      "observation": "What you observed across feeds",
      "direction": "increasing|decreasing|stable",
      "significance": "Why it matters"
    }
  ],
  "feed_health": {
    "healthy_feeds": number,
    "stale_feeds": ["feed names with no recent data"],
    "recommendations": ["any feed-specific recommendations"]
  },
  "recommendations": [
    "Actionable recommendation 1",
    "Actionable recommendation 2"
  ],
  "action_playbook": [
    {
      "finding_ref": "Name of the campaign or risk this relates to",
      "category": "investigate|escalate|defend|track",
      "title": "Short action title (e.g. 'WHOIS lookup on suspicious domain')",
      "description": "What to do and why, with specific targets",
      "executable": true,
      "action_type": "open_ticket|create_erasure|block_domain|osint_lookup|abuse_report|law_enforcement|isac_share|add_watchlist",
      "action_data": {
        "target": "specific domain, IP, actor, or brand name",
        "severity": "critical|high|medium|low",
        "template": "For advisory actions only: pre-filled template text (e.g. abuse report email body, law enforcement referral letter, ISAC sharing format). Leave empty for executable actions."
      },
      "urgency": "immediate|short_term|ongoing"
    }
  ]
}

IMPORTANT for action_playbook:
- Generate 5-15 specific, actionable items based on the actual data
- executable=true for: open_ticket, create_erasure, block_domain, add_watchlist (these trigger platform functions)
- executable=false for: abuse_report, law_enforcement, isac_share, osint_lookup (these provide templates/guidance)
- For law_enforcement actions, include IC3/CISA contact info in template
- For abuse_report actions, include a draft email template with the specific domain/IP
- For osint_lookup actions, suggest specific tools (WHOIS, Shodan, VirusTotal, URLScan)
- Reference specific domains, IPs, brands, and CVEs from the data — never be generic`;

    const userPrompt = `Analyze the following multi-source threat intelligence data:

## Active Threats (${threats?.length || 0} records)
severity | brand | domain | attack_type | source | country | confidence | last_seen
${threatSummary || 'No threats data available'}

## Vulnerability News / KEVs (${news?.length || 0} records)
severity | source | cve_id | vendor | product | title
${newsSummary || 'No news data available'}

## Social Media IOCs (${socialIocs?.length || 0} records)
${socialSummary || 'No social IOC data available'}

## Account Takeover Events (${atoEvents?.length || 0} records)
${atoSummary || 'No ATO events'}

## Breach Check Results (${breachChecks?.length || 0} records)
${breachSummary || 'No breach checks'}

## Tor Exit Nodes
${torSummary}

## Takedown / Erasure Actions (${erasureActions?.length || 0} records)
${erasureSummary || 'No erasure actions'}

## Attack Metrics (${metrics?.length || 0} records)
${metricsSummary || 'No metrics data available'}

## Feed Health Status
${feedHealthSummary || 'No ingestion job data'}

Identify:
1. Cross-feed correlated campaigns (e.g., domain in threats + IOC in social + CVE in news)
2. Top priority risks requiring immediate action
3. Emerging trends across all attack vectors
4. Feed health issues (stale or failing feeds)
5. Specific, actionable recommendations for the security team`;

    // Multi-model failover for resilience
    const models = [
      'google/gemini-3-flash-preview',
      'google/gemini-2.5-flash',
      'openai/gpt-5-mini',
    ];

    let aiData: any = null;
    let lastErr = '';

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            }),
          });

          if (aiResponse.status === 429) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again shortly.' }), {
              status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (aiResponse.status === 402) {
            return new Response(JSON.stringify({ error: 'AI credits exhausted. Add funds in workspace settings.' }), {
              status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          if (!aiResponse.ok) {
            lastErr = `${model} returned ${aiResponse.status}: ${await aiResponse.text()}`;
            console.error(lastErr);
            if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
            continue;
          }

          aiData = await aiResponse.json();
          break;
        } catch (e) {
          lastErr = `${model} error: ${e instanceof Error ? e.message : String(e)}`;
          console.error(lastErr);
          if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
        }
      }
      if (aiData) break;
    }

    if (!aiData) {
      return new Response(
        JSON.stringify({ success: false, error: `All AI models failed. Last: ${lastErr}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const content = aiData.choices?.[0]?.message?.content || '';

    // Parse JSON from AI response (handle markdown code blocks)
    let briefing;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      briefing = JSON.parse(jsonStr);
    } catch {
      briefing = {
        executive_summary: content,
        campaigns: [],
        top_risks: [],
        trends: [],
        feed_health: { healthy_feeds: 0, stale_feeds: [], recommendations: [] },
        recommendations: [],
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        briefing,
        data_summary: {
          threats_analyzed: threats?.length || 0,
          news_analyzed: news?.length || 0,
          metrics_analyzed: metrics?.length || 0,
          social_iocs_analyzed: socialIocs?.length || 0,
          ato_events_analyzed: atoEvents?.length || 0,
          breach_checks_analyzed: breachChecks?.length || 0,
          tor_nodes_tracked: torNodes?.length || 0,
          erasure_actions_analyzed: erasureActions?.length || 0,
        },
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Threat briefing error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

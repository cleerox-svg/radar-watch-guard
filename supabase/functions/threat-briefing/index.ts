/**
 * threat-briefing — Supabase Edge Function (v2 — optimized)
 *
 * Speed optimizations:
 *   - Reduced row limits (80 threats, 20 news, etc.)
 *   - Fastest model first (gemini-2.5-flash-lite)
 *   - 20s timeout with AbortController
 *   - Persists briefing to threat_briefings table for caching/history
 *   - Optional ?cached=true to return latest non-expired briefing
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

    // ─── Check for cached briefing ───
    const url = new URL(req.url);
    const wantCached = url.searchParams.get('cached') === 'true';

    if (wantCached) {
      const { data: cached } = await supabase
        .from('threat_briefings')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        return new Response(JSON.stringify({
          success: true,
          briefing: cached.briefing,
          data_summary: cached.data_summary,
          generated_at: cached.generated_at,
          briefing_id: cached.id,
          from_cache: true,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // ─── Parallel data fetching — reduced limits for speed ───
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
        .order('last_seen', { ascending: false }).limit(80),
      supabase.from('threat_news')
        .select('title, severity, source, cve_id, vendor, product, date_published, description')
        .order('date_published', { ascending: false }).limit(20),
      supabase.from('attack_metrics')
        .select('metric_name, metric_value, category, country, recorded_at')
        .order('recorded_at', { ascending: false }).limit(20),
      supabase.from('social_iocs')
        .select('ioc_type, ioc_value, source, confidence, tags, date_shared, source_user')
        .order('date_shared', { ascending: false }).limit(30),
      supabase.from('ato_events')
        .select('event_type, user_email, risk_score, location_from, location_to, detected_at, resolved')
        .order('detected_at', { ascending: false }).limit(15),
      supabase.from('breach_checks')
        .select('check_type, check_value, breaches_found, risk_level, breach_names, last_checked')
        .order('last_checked', { ascending: false }).limit(15),
      supabase.from('tor_exit_nodes')
        .select('ip_address, last_seen')
        .order('last_seen', { ascending: false }).limit(30),
      supabase.from('erasure_actions')
        .select('action, provider, target, status, type, created_at, completed_at')
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('ingestion_jobs')
        .select('feed_source, status, records_processed, completed_at, error_message')
        .order('created_at', { ascending: false }).limit(20),
    ]);

    // ─── Build compact summaries ───
    const threatSummary = (threats || []).map(t =>
      `${t.severity}|${t.brand}|${t.domain}|${t.attack_type}|${t.source}|${t.country || '?'}|${t.confidence}%|${t.last_seen}`
    ).join('\n');

    const newsSummary = (news || []).map(n =>
      `${n.severity}|${n.source}|${n.cve_id || ''}|${n.vendor || ''}|${n.title}`
    ).join('\n');

    const metricsSummary = (metrics || []).map(m =>
      `${m.metric_name}:${m.metric_value}(${m.category || ''},${m.country || 'global'})`
    ).join('\n');

    const socialSummary = (socialIocs || []).map(s =>
      `[${s.confidence}]${s.ioc_type}:${s.ioc_value}|${(s.tags || []).join(',')}|${s.source}`
    ).join('\n');

    const atoSummary = (atoEvents || []).map(a =>
      `${a.event_type}|${a.user_email}|risk:${a.risk_score}|${a.location_from}→${a.location_to}|${a.resolved ? 'R' : 'OPEN'}`
    ).join('\n');

    const breachSummary = (breachChecks || []).map(b =>
      `${b.check_type}:${b.check_value}|risk:${b.risk_level}|${b.breaches_found}breaches`
    ).join('\n');

    const torSummary = `${(torNodes || []).length} Tor exit nodes`;

    const erasureSummary = (erasureActions || []).map(e =>
      `${e.action}|${e.provider}→${e.target}|${e.status}`
    ).join('\n');

    const feedHealth = (ingestionJobs || []).reduce((acc: Record<string, { status: string; records: number }>, j: any) => {
      if (!acc[j.feed_source]) acc[j.feed_source] = { status: j.status, records: j.records_processed || 0 };
      return acc;
    }, {});
    const feedHealthSummary = Object.entries(feedHealth).map(([src, info]: [string, any]) =>
      `${src}:${info.status}(${info.records})`
    ).join('\n');

    const systemPrompt = `You are a senior threat intelligence analyst for LRX Radar. Analyze multi-source data and produce a structured JSON briefing.

IMPORTANT: For EACH campaign and risk, include a "data_points" array listing the specific records/evidence used (domain names, IPs, IOC values, CVE IDs, email addresses, etc.) and a "correlation_logic" string explaining HOW you connected the dots across feeds.

Return ONLY valid JSON:
{
  "executive_summary": "2-3 sentences",
  "campaigns": [{
    "name": "str", "description": "str", "domains_count": num,
    "brands_targeted": ["str"], "severity": "critical|high|medium",
    "sources_correlated": ["feed1","feed2"],
    "recommendation": "str",
    "data_points": [{"source": "feed_name", "type": "domain|ip|ioc|cve|email", "value": "specific value", "context": "why relevant"}],
    "correlation_logic": "How these data points connect across feeds"
  }],
  "top_risks": [{
    "title": "str", "detail": "str", "priority": "immediate|short_term|monitor",
    "action": "str", "data_sources": ["feeds"],
    "data_points": [{"source": "feed_name", "type": "str", "value": "str", "context": "str"}],
    "correlation_logic": "How determined"
  }],
  "trends": [{"observation": "str", "direction": "increasing|decreasing|stable", "significance": "str"}],
  "feed_health": {"healthy_feeds": num, "stale_feeds": ["str"], "recommendations": ["str"]},
  "recommendations": ["str"],
  "action_playbook": [{
    "finding_ref": "str", "category": "investigate|escalate|defend|track",
    "title": "str", "description": "str", "executable": bool,
    "action_type": "open_ticket|create_erasure|block_domain|osint_lookup|abuse_report|law_enforcement|isac_share|add_watchlist",
    "action_data": {"target": "str", "severity": "str", "template": "str"},
    "urgency": "immediate|short_term|ongoing"
  }]
}

Generate 5-15 playbook actions referencing specific data. executable=true for open_ticket/create_erasure/block_domain/add_watchlist.`;

    const userPrompt = `## Threats (${threats?.length || 0})
${threatSummary || 'None'}

## News/KEVs (${news?.length || 0})
${newsSummary || 'None'}

## Social IOCs (${socialIocs?.length || 0})
${socialSummary || 'None'}

## ATO Events (${atoEvents?.length || 0})
${atoSummary || 'None'}

## Breach Checks (${breachChecks?.length || 0})
${breachSummary || 'None'}

## Tor Nodes
${torSummary}

## Erasure Actions (${erasureActions?.length || 0})
${erasureSummary || 'None'}

## Metrics (${metrics?.length || 0})
${metricsSummary || 'None'}

## Feed Health
${feedHealthSummary || 'None'}

Identify cross-feed campaigns, priority risks, trends, feed issues, and actionable recommendations. Include data_points and correlation_logic for each finding.`;

    // ─── Fast model-first failover with 20s timeout ───
    const models = [
      'google/gemini-2.5-flash-lite',
      'google/gemini-2.5-flash',
      'google/gemini-3-flash-preview',
    ];

    let aiData: any = null;
    let lastErr = '';
    const timeoutMs = 20000;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);

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
            signal: controller.signal,
          });

          clearTimeout(timer);

          if (aiResponse.status === 429) {
            return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again shortly.' }), {
              status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (aiResponse.status === 402) {
            return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
              status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          if (!aiResponse.ok) {
            lastErr = `${model} ${aiResponse.status}`;
            console.error(lastErr, await aiResponse.text());
            if (attempt === 0) await new Promise(r => setTimeout(r, 800));
            continue;
          }

          aiData = await aiResponse.json();
          break;
        } catch (e) {
          lastErr = `${model}: ${e instanceof Error ? e.message : String(e)}`;
          console.error(lastErr);
          if (attempt === 0) await new Promise(r => setTimeout(r, 800));
        }
      }
      if (aiData) break;
    }

    if (!aiData) {
      return new Response(
        JSON.stringify({ success: false, error: `All models failed. ${lastErr}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const content = aiData.choices?.[0]?.message?.content || '';

    let briefing;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      briefing = JSON.parse(jsonStr);
    } catch {
      briefing = {
        executive_summary: content,
        campaigns: [], top_risks: [], trends: [],
        feed_health: { healthy_feeds: 0, stale_feeds: [], recommendations: [] },
        recommendations: [],
      };
    }

    const dataSummary = {
      threats_analyzed: threats?.length || 0,
      news_analyzed: news?.length || 0,
      metrics_analyzed: metrics?.length || 0,
      social_iocs_analyzed: socialIocs?.length || 0,
      ato_events_analyzed: atoEvents?.length || 0,
      breach_checks_analyzed: breachChecks?.length || 0,
      tor_nodes_tracked: torNodes?.length || 0,
      erasure_actions_analyzed: erasureActions?.length || 0,
    };

    const generatedAt = new Date().toISOString();

    // ─── Persist to history ───
    const { data: saved } = await supabase
      .from('threat_briefings')
      .insert({
        briefing,
        data_summary: dataSummary,
        generated_at: generatedAt,
        expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      })
      .select('id')
      .single();

    return new Response(
      JSON.stringify({
        success: true,
        briefing,
        data_summary: dataSummary,
        generated_at: generatedAt,
        briefing_id: saved?.id || null,
        from_cache: false,
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

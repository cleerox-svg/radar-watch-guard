/**
 * threat-chat — Supabase Edge Function
 *
 * Streaming AI chat with full cross-feed context. Queries ALL platform data
 * (except spam_trap) to give the analyst comprehensive situational awareness.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) throw new Error('messages array required');

    // ─── Parallel fetch of ALL feed data for comprehensive context ───
    const [
      { data: threats },
      { data: news },
      { data: atoEvents },
      { data: socialIocs },
      { data: breachChecks },
      { data: torNodes },
      { data: erasureActions },
      { data: ingestionJobs },
    ] = await Promise.all([
      supabase.from('threats')
        .select('brand, domain, attack_type, severity, status, source, country, confidence, first_seen, last_seen')
        .order('last_seen', { ascending: false }).limit(100),
      supabase.from('threat_news')
        .select('title, severity, source, cve_id, vendor, product, date_published')
        .order('date_published', { ascending: false }).limit(15),
      supabase.from('ato_events')
        .select('event_type, user_email, risk_score, location_from, location_to, detected_at, resolved')
        .order('detected_at', { ascending: false }).limit(10),
      supabase.from('social_iocs')
        .select('ioc_type, ioc_value, source, confidence, tags, date_shared')
        .order('date_shared', { ascending: false }).limit(30),
      supabase.from('breach_checks')
        .select('check_type, check_value, breaches_found, risk_level, breach_names, last_checked')
        .order('last_checked', { ascending: false }).limit(10),
      supabase.from('tor_exit_nodes')
        .select('ip_address, last_seen')
        .order('last_seen', { ascending: false }).limit(20),
      supabase.from('erasure_actions')
        .select('action, provider, target, status, type, created_at')
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('ingestion_jobs')
        .select('feed_source, status, records_processed, completed_at')
        .order('created_at', { ascending: false }).limit(24),
    ]);

    const contextData = `
## Current Threat Database (${threats?.length || 0} active threats)
${(threats || []).slice(0, 50).map(t => `- [${t.severity}] ${t.brand} → ${t.domain} (${t.attack_type}, ${t.source}, confidence: ${t.confidence}%${t.country ? ', ' + t.country : ''})`).join('\n')}

## Vulnerability Advisories (${news?.length || 0})
${(news || []).map(n => `- [${n.severity}] ${n.cve_id || ''} ${n.vendor || ''} ${n.product || ''}: ${n.title} (source: ${n.source})`).join('\n')}

## Account Takeover Events (${atoEvents?.length || 0})
${(atoEvents || []).map(e => `- [${e.event_type}] ${e.user_email} risk:${e.risk_score} ${e.location_from}→${e.location_to} ${e.resolved ? 'RESOLVED' : 'OPEN'}`).join('\n')}

## Social Media IOCs (${socialIocs?.length || 0})
${(socialIocs || []).slice(0, 20).map(s => `- [${s.confidence}] ${s.ioc_type}: ${s.ioc_value} (${s.source}, tags: ${(s.tags || []).join(',')})`).join('\n')}

## Breach Check Results (${breachChecks?.length || 0})
${(breachChecks || []).map(b => `- ${b.check_type}: ${b.check_value} → risk:${b.risk_level}, ${b.breaches_found} breaches`).join('\n')}

## Tor Exit Nodes: ${torNodes?.length || 0} tracked

## Active Takedown Actions (${erasureActions?.length || 0})
${(erasureActions || []).map(e => `- ${e.action} → ${e.target} via ${e.provider} (${e.status})`).join('\n')}

## Feed Ingestion Health (latest per source)
${(ingestionJobs || []).slice(0, 24).map(j => `- ${j.feed_source}: ${j.status} (${j.records_processed || 0} records, ${j.completed_at || 'pending'})`).join('\n')}
`;

    const systemPrompt = `You are the AI analyst for LRX Radar, a global phishing defense and threat intelligence platform. You have access to the platform's live data from ALL feeds (threats, vulnerabilities, social IOCs, ATO events, breach checks, Tor nodes, takedown actions, and feed health).

Answer analyst questions using the data. Be specific — cite exact domains, CVEs, brands, IOCs, and numbers. Cross-reference across data sources when relevant. When asked about trends, compare data points. When asked for recommendations, be actionable and specific.

If asked about data you don't have, say so clearly rather than guessing.

Format responses with markdown for readability. Use tables when comparing data, bullet lists for recommendations, and bold for key findings.

${contextData}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Add funds in workspace settings.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (e) {
    console.error('threat-chat error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

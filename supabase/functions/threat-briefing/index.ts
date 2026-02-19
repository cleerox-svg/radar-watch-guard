/**
 * threat-briefing — Supabase Edge Function
 *
 * Queries recent threats and threat_news from the database, then sends
 * the data to Lovable AI for analysis. Returns a structured intelligence
 * briefing with campaign patterns, risk priorities, and recommendations.
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

    // Fetch recent threats (last 100)
    const { data: threats } = await supabase
      .from('threats')
      .select('brand, domain, attack_type, severity, status, source, country, first_seen, last_seen')
      .order('last_seen', { ascending: false })
      .limit(100);

    // Fetch recent threat news / KEVs
    const { data: news } = await supabase
      .from('threat_news')
      .select('title, severity, source, cve_id, vendor, product, date_published, metadata')
      .order('date_published', { ascending: false })
      .limit(20);

    // Fetch attack metrics
    const { data: metrics } = await supabase
      .from('attack_metrics')
      .select('metric_name, metric_value, category, country, recorded_at')
      .order('recorded_at', { ascending: false })
      .limit(30);

    // Build the analysis prompt
    const threatSummary = (threats || []).map(t =>
      `${t.severity} | ${t.brand} | ${t.domain} | ${t.attack_type} | ${t.source} | ${t.country || 'N/A'} | ${t.last_seen}`
    ).join('\n');

    const newsSummary = (news || []).map(n =>
      `${n.severity} | ${n.source} | ${n.cve_id || 'N/A'} | ${n.vendor || 'N/A'} | ${n.product || 'N/A'} | ${n.title}`
    ).join('\n');

    const metricsSummary = (metrics || []).map(m =>
      `${m.metric_name}: ${m.metric_value} (${m.category || 'N/A'}, ${m.country || 'global'})`
    ).join('\n');

    const systemPrompt = `You are a senior threat intelligence analyst for LRX Radar, a global phishing defense platform. Analyze the provided threat data and produce a structured intelligence briefing.

Your analysis must be data-driven, referencing specific numbers, domains, brands, and CVEs from the data provided. Be direct and actionable.

Format your response as JSON matching this exact structure:
{
  "executive_summary": "2-3 sentence overview of the current threat landscape",
  "campaigns": [
    {
      "name": "Campaign name",
      "description": "What this campaign involves",
      "domains_count": number,
      "brands_targeted": ["brand1", "brand2"],
      "severity": "critical|high|medium",
      "recommendation": "Specific action to take"
    }
  ],
  "top_risks": [
    {
      "title": "Risk title",
      "detail": "Why this is a risk",
      "priority": "immediate|short_term|monitor",
      "action": "What to do"
    }
  ],
  "trends": [
    {
      "observation": "What you observed",
      "direction": "increasing|decreasing|stable",
      "significance": "Why it matters"
    }
  ],
  "recommendations": [
    "Actionable recommendation 1",
    "Actionable recommendation 2"
  ]
}`;

    const userPrompt = `Analyze the following threat intelligence data:

## Active Threats (${threats?.length || 0} records)
severity | brand | domain | attack_type | source | country | last_seen
${threatSummary || 'No threats data available'}

## Vulnerability News / KEVs (${news?.length || 0} records)
severity | source | cve_id | vendor | product | title
${newsSummary || 'No news data available'}

## Attack Metrics (${metrics?.length || 0} records)
${metricsSummary || 'No metrics data available'}

Identify:
1. Coordinated phishing campaigns (group related domains/brands)
2. Top priority risks requiring immediate action
3. Emerging trends in attack patterns
4. Specific, actionable recommendations for the security team`;

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

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Parse the JSON from the AI response (handle markdown code blocks)
    let briefing;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      briefing = JSON.parse(jsonStr);
    } catch {
      // If JSON parsing fails, return raw content
      briefing = {
        executive_summary: content,
        campaigns: [],
        top_risks: [],
        trends: [],
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
        },
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Threat briefing error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

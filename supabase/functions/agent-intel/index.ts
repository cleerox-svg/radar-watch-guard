/**
 * agent-intel — Executive Intelligence Agent
 * Generates C-suite briefings, brand risk scorecards, and trend forecasts.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { run_id } = await req.json();

    await supabase.from('agent_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', run_id);

    // Comprehensive data pull
    const [{ data: threats }, { data: news }, { data: atoEvents }, { data: erasureActions }, { data: breachChecks }] = await Promise.all([
      supabase.from('threats').select('brand, domain, attack_type, severity, status, source, country, first_seen')
        .order('last_seen', { ascending: false }).limit(200),
      supabase.from('threat_news').select('title, severity, cve_id, vendor, product, date_published')
        .order('date_published', { ascending: false }).limit(20),
      supabase.from('ato_events').select('event_type, risk_score, resolved, detected_at')
        .order('detected_at', { ascending: false }).limit(20),
      supabase.from('erasure_actions').select('action, status, target, provider')
        .order('created_at', { ascending: false }).limit(20),
      supabase.from('breach_checks').select('check_type, risk_level, breaches_found')
        .order('last_checked', { ascending: false }).limit(10),
    ]);

    // Compute quick stats
    const severityCounts: Record<string, number> = {};
    const brandCounts: Record<string, number> = {};
    (threats || []).forEach(t => {
      severityCounts[t.severity] = (severityCounts[t.severity] || 0) + 1;
      brandCounts[t.brand] = (brandCounts[t.brand] || 0) + 1;
    });

    const systemPrompt = `You are an executive intelligence agent producing board-level security briefings. Analyze ALL provided data and return JSON:
{
  "executive_summary": "3-4 sentence board-ready overview of the current threat posture",
  "risk_score": 1-100,
  "risk_trend": "increasing|stable|decreasing",
  "brand_scorecards": [
    {"brand": "Name", "risk_score": 1-100, "active_threats": N, "top_attack_type": "type", "trend": "up|stable|down", "recommendation": "1 sentence"}
  ],
  "key_metrics": {
    "total_active_threats": N,
    "critical_threats": N,
    "open_ato_events": N,
    "pending_takedowns": N,
    "active_cves": N
  },
  "trend_forecast": "2-3 sentence forecast of where threats are heading",
  "top_recommendations": [
    {"priority": 1, "action": "specific action", "impact": "expected impact", "effort": "low|medium|high"}
  ],
  "talking_points": ["board-ready bullet point 1", "point 2", "point 3"]
}
Only return valid JSON.`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate executive intelligence report:\n\nSeverity distribution: ${JSON.stringify(severityCounts)}\nTop brands: ${JSON.stringify(Object.entries(brandCounts).sort((a,b) => b[1]-a[1]).slice(0,10))}\nTotal threats: ${threats?.length || 0}\nRecent KEVs: ${(news || []).slice(0,10).map(n => `${n.cve_id || ''} ${n.severity} ${n.vendor || ''}`).join('; ')}\nATO events: ${atoEvents?.length || 0} (${(atoEvents || []).filter(a => !a.resolved).length} open)\nErasure actions: ${(erasureActions || []).filter(e => e.status === 'pending').length} pending\nBreach checks: ${(breachChecks || []).filter(b => b.risk_level === 'high' || b.risk_level === 'critical').length} high-risk` },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      await resp.text();
      await supabase.from('agent_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: `AI error ${resp.status}` }).eq('id', run_id);
      return new Response(JSON.stringify({ success: false }), { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const aiData = await resp.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    let results;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      results = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim());
    } catch {
      results = { executive_summary: content, brand_scorecards: [], top_recommendations: [] };
    }

    await supabase.from('agent_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      summary: results.executive_summary || 'Intel report generated',
      items_processed: (threats?.length || 0) + (news?.length || 0),
      items_flagged: results.brand_scorecards?.length || 0,
      results,
    }).eq('id', run_id);

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('agent-intel error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

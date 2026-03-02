/**
 * agent-response — Response Agent
 * Auto-drafts takedown notices, suggests erasure actions, and recommends mitigations.
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

    // Fetch critical/high threats that haven't been mitigated
    const [{ data: threats }, { data: erasureActions }] = await Promise.all([
      supabase.from('threats').select('id, brand, domain, attack_type, severity, confidence, source, country, ip_address, isp, abuse_contact, org_name')
        .in('severity', ['critical', 'high']).eq('status', 'active')
        .order('last_seen', { ascending: false }).limit(50),
      supabase.from('erasure_actions').select('target, status, action')
        .in('status', ['pending', 'in_progress']).limit(50),
    ]);

    const existingTargets = new Set((erasureActions || []).map(e => e.target));
    const unaddressed = (threats || []).filter(t => !existingTargets.has(t.domain));

    if (!unaddressed.length) {
      await supabase.from('agent_runs').update({
        status: 'completed', completed_at: new Date().toISOString(),
        summary: 'All critical/high threats already have active response actions.',
        items_processed: threats?.length || 0, items_flagged: 0, results: { actions: [] },
      }).eq('id', run_id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const threatData = unaddressed.slice(0, 30).map(t =>
      `${t.brand}|${t.domain}|${t.attack_type}|${t.severity}|${t.ip_address || ''}|${t.isp || ''}|${t.abuse_contact || ''}|${t.org_name || ''}`
    ).join('\n');

    const systemPrompt = `You are a response automation agent for a phishing defense platform. For each unaddressed high/critical threat, generate takedown notices and erasure actions. Return JSON:
{
  "response_plans": [
    {
      "domain": "phish.example.com",
      "brand": "BrandName",
      "severity": "critical",
      "takedown_notice": "Full text of abuse takedown notice email ready to send",
      "suggested_erasure_actions": [
        {"action": "DMCA takedown|Abuse report|Registrar complaint|Hosting provider notice", "provider": "provider name", "target": "domain", "priority": "immediate|short_term"}
      ],
      "mitre_mitigations": [
        {"technique": "T1566", "mitigation": "specific action"}
      ]
    }
  ],
  "summary": "2-3 sentence overview of recommended responses",
  "stats": {"domains_addressed": N, "takedown_notices_drafted": N, "erasure_actions_suggested": N}
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
          { role: 'user', content: `Generate response plans for these ${unaddressed.length} unaddressed critical/high threats:\n${threatData}` },
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
      results = { summary: content, response_plans: [], stats: {} };
    }

    await supabase.from('agent_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      summary: results.summary || `Generated response plans for ${unaddressed.length} threats`,
      items_processed: unaddressed.length,
      items_flagged: results.stats?.takedown_notices_drafted || results.response_plans?.length || 0,
      results,
    }).eq('id', run_id);

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('agent-response error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

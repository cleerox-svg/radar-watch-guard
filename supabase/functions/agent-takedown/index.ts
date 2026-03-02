/**
 * agent-takedown — Takedown Orchestrator Agent
 * Detects impersonating domains → drafts abuse notices → creates approval for human review.
 * Okta-ready: accepts identity_context in request for future IdP integration.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { run_id, identity_context } = await req.json();

    await supabase.from('agent_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', run_id);

    // Fetch critical/high active threats without existing erasure actions
    const [{ data: threats }, { data: existingActions }] = await Promise.all([
      supabase.from('threats')
        .select('id, brand, domain, attack_type, severity, confidence, ip_address, isp, abuse_contact, org_name, country, asn')
        .in('severity', ['critical', 'high']).eq('status', 'active')
        .order('last_seen', { ascending: false }).limit(50),
      supabase.from('erasure_actions').select('target').in('status', ['pending', 'in_progress']),
    ]);

    const existingTargets = new Set((existingActions || []).map((e: any) => e.target));
    const unaddressed = (threats || []).filter(t => !existingTargets.has(t.domain));

    if (!unaddressed.length) {
      await supabase.from('agent_runs').update({
        status: 'completed', completed_at: new Date().toISOString(),
        summary: 'No unaddressed threats requiring takedown.',
        items_processed: 0, items_flagged: 0, results: { approvals_created: 0 },
      }).eq('id', run_id);
      return new Response(JSON.stringify({ success: true, approvals_created: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate takedown notices via AI
    const threatData = unaddressed.slice(0, 20).map(t =>
      `${t.brand}|${t.domain}|${t.attack_type}|${t.severity}|${t.ip_address || ''}|${t.isp || ''}|${t.abuse_contact || ''}|${t.org_name || ''}|${t.country || ''}|${t.asn || ''}`
    ).join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: `You are a takedown orchestration agent. For each threat, generate a professional abuse takedown notice and evidence package. Return JSON:
{
  "takedowns": [
    {
      "domain": "...",
      "brand": "...",
      "severity": "...",
      "abuse_notice": "Full professional abuse notice email text",
      "evidence_summary": "Key evidence points",
      "recommended_recipients": ["registrar abuse@", "hosting provider abuse@"],
      "escalation_timeline": "48h initial, 72h escalation",
      "mitre_technique": "T1566.xxx"
    }
  ],
  "summary": "2-3 sentence overview"
}
Only return valid JSON.` },
          { role: 'user', content: `Generate takedown packages for these ${unaddressed.length} threats:\n${threatData}` },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    let results: any = { takedowns: [], summary: 'AI generation failed' };
    if (resp.ok) {
      const aiData = await resp.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        results = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim());
      } catch { results = { takedowns: [], summary: content.slice(0, 500) }; }
    } else {
      await resp.text();
    }

    // Create approval items for each takedown (human-in-the-loop)
    let approvalsCreated = 0;
    for (const td of (results.takedowns || []).slice(0, 15)) {
      const { error } = await supabase.from('agent_approvals').insert({
        agent_run_id: run_id,
        agent_type: 'takedown',
        action_type: 'takedown',
        title: `Takedown: ${td.domain} (${td.brand})`,
        description: td.evidence_summary || `Abuse notice for ${td.domain}`,
        payload: td,
        priority: td.severity === 'critical' ? 'critical' : 'high',
        identity_provider: identity_context?.provider || 'internal',
        identity_context: identity_context || {},
      });
      if (!error) approvalsCreated++;
    }

    await supabase.from('agent_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      summary: `Generated ${approvalsCreated} takedown approvals for review`,
      items_processed: unaddressed.length, items_flagged: approvalsCreated,
      results: { ...results, approvals_created: approvalsCreated },
    }).eq('id', run_id);

    return new Response(JSON.stringify({ success: true, approvals_created: approvalsCreated, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('agent-takedown error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

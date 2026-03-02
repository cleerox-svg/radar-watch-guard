/**
 * agent-impersonation — Brand Impersonation Detector Agent
 * Monitors CertStream + social + phishing feeds for lookalike domains/profiles.
 * Creates approvals for analyst confirmation (legit vs impersonation).
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

    // Fetch recent threats from CertStream and phishing sources
    const [{ data: certThreats }, { data: socialIocs }, { data: recentApprovals }] = await Promise.all([
      supabase.from('threats')
        .select('id, brand, domain, attack_type, severity, confidence, source, first_seen, ip_address, country')
        .in('source', ['certstream', 'phishtank', 'phishtank_community', 'openphish'])
        .eq('status', 'active')
        .order('first_seen', { ascending: false }).limit(100),
      supabase.from('social_iocs')
        .select('ioc_value, ioc_type, source, confidence, tags')
        .order('date_shared', { ascending: false }).limit(50),
      supabase.from('agent_approvals')
        .select('payload')
        .eq('agent_type', 'impersonation')
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: false }).limit(50),
    ]);

    // Deduplicate — skip domains already in approval queue
    const alreadyQueued = new Set((recentApprovals || []).map((a: any) => a.payload?.domain).filter(Boolean));
    const newThreats = (certThreats || []).filter(t => !alreadyQueued.has(t.domain));

    if (!newThreats.length) {
      await supabase.from('agent_runs').update({
        status: 'completed', completed_at: new Date().toISOString(),
        summary: 'No new impersonation candidates found.',
        items_processed: certThreats?.length || 0, items_flagged: 0, results: { candidates: 0 },
      }).eq('id', run_id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const threatSummary = newThreats.slice(0, 30).map(t =>
      `${t.brand}|${t.domain}|${t.attack_type}|${t.confidence}|${t.source}`
    ).join('\n');

    const socialContext = (socialIocs || []).slice(0, 20).map(s =>
      `${s.ioc_type}:${s.ioc_value}|${s.source}|${s.confidence}`
    ).join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: `You are a brand impersonation detection agent. Analyze domains and IOCs for brand impersonation patterns. Score each candidate and flag for human review. Return JSON:
{
  "candidates": [
    {
      "domain": "...",
      "brand": "...",
      "impersonation_type": "typosquat|homograph|subdomain|lookalike|clone",
      "confidence": 0-100,
      "evidence": "Why this is likely impersonation",
      "risk_to_trust_score": "high|medium|low",
      "recommended_action": "takedown|monitor|investigate"
    }
  ],
  "summary": "overview"
}
Only return valid JSON.` },
          { role: 'user', content: `Analyze these for impersonation:\nThreats:\n${threatSummary}\n\nSocial IOCs:\n${socialContext}` },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    let results: any = { candidates: [] };
    if (resp.ok) {
      const aiData = await resp.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        results = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim());
      } catch { results = { candidates: [], summary: content.slice(0, 500) }; }
    } else { await resp.text(); }

    // Create approval for each high-confidence candidate
    let approvalsCreated = 0;
    for (const c of (results.candidates || []).filter((c: any) => c.confidence >= 60)) {
      const { error } = await supabase.from('agent_approvals').insert({
        agent_run_id: run_id,
        agent_type: 'impersonation',
        action_type: 'escalation',
        title: `Impersonation: ${c.domain} → ${c.brand}`,
        description: c.evidence,
        payload: c,
        priority: c.confidence >= 85 ? 'critical' : c.confidence >= 70 ? 'high' : 'medium',
        identity_provider: identity_context?.provider || 'internal',
        identity_context: identity_context || {},
      });
      if (!error) approvalsCreated++;
    }

    await supabase.from('agent_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      summary: `Found ${results.candidates?.length || 0} impersonation candidates, ${approvalsCreated} queued for review`,
      items_processed: newThreats.length, items_flagged: approvalsCreated,
      results: { ...results, approvals_created: approvalsCreated },
    }).eq('id', run_id);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('agent-impersonation error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

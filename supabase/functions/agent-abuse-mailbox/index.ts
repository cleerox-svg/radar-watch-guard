/**
 * agent-abuse-mailbox — Abuse Mailbox Triage Agent
 * Processes reported phishing emails, extracts IOCs, cross-references threat DB.
 * Creates approvals for analyst to confirm classification.
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

    // Fetch pending abuse mailbox items
    const { data: pendingItems } = await supabase.from('abuse_mailbox')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(30);

    if (!pendingItems?.length) {
      await supabase.from('agent_runs').update({
        status: 'completed', completed_at: new Date().toISOString(),
        summary: 'No pending abuse reports to triage.',
        items_processed: 0, items_flagged: 0, results: { triaged: 0 },
      }).eq('id', run_id);
      return new Response(JSON.stringify({ success: true, triaged: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cross-reference extracted URLs/domains against threat DB
    const allUrls = pendingItems.flatMap(i => i.extracted_urls || []);
    const allDomains = [...new Set(allUrls.map(u => { try { return new URL(u).hostname; } catch { return u; } }))];

    const { data: matchingThreats } = await supabase.from('threats')
      .select('id, domain, brand, severity')
      .in('domain', allDomains.slice(0, 50));

    const threatDomainMap = new Map((matchingThreats || []).map(t => [t.domain, t]));

    // AI classification
    const itemSummary = pendingItems.map(i =>
      `FROM:${i.sender_email}|DOMAIN:${i.sender_domain}|SUBJECT:${i.subject || ''}|URLS:${(i.extracted_urls || []).join(',')}|MATCHES:${(i.extracted_urls || []).filter(u => { try { return threatDomainMap.has(new URL(u).hostname); } catch { return false; } }).length}`
    ).join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: `You are an abuse mailbox triage agent. Classify each reported email. Return JSON:
{
  "classifications": [
    {
      "index": 0,
      "classification": "phishing|spam|legitimate|suspicious",
      "confidence": 0-100,
      "reasoning": "why this classification",
      "recommended_action": "escalate|close|monitor|takedown"
    }
  ],
  "summary": "overview"
}
Only return valid JSON.` },
          { role: 'user', content: `Classify these ${pendingItems.length} reported emails:\n${itemSummary}` },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    let results: any = { classifications: [] };
    if (resp.ok) {
      const aiData = await resp.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        results = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim());
      } catch { results = { classifications: [], summary: content.slice(0, 500) }; }
    } else { await resp.text(); }

    // Update items and create approvals
    let triaged = 0;
    for (const cls of (results.classifications || [])) {
      const item = pendingItems[cls.index];
      if (!item) continue;

      // Cross-ref threat IDs
      const crossRefIds = (item.extracted_urls || [])
        .map((u: string) => { try { return threatDomainMap.get(new URL(u).hostname)?.id; } catch { return null; } })
        .filter(Boolean);

      await supabase.from('abuse_mailbox').update({
        classification: cls.classification,
        confidence_score: cls.confidence || 0,
        cross_ref_threat_ids: crossRefIds,
        auto_actions_taken: [{ action: 'ai_classification', result: cls.classification, confidence: cls.confidence, timestamp: new Date().toISOString() }],
      }).eq('id', item.id);

      // Create approval for analyst confirmation
      if (cls.classification !== 'legitimate' && cls.confidence < 95) {
        await supabase.from('agent_approvals').insert({
          agent_run_id: run_id,
          agent_type: 'abuse_mailbox',
          action_type: 'abuse_triage',
          title: `Triage: ${item.sender_email} → ${cls.classification}`,
          description: cls.reasoning,
          payload: { item_id: item.id, ...cls, sender: item.sender_email, subject: item.subject },
          priority: cls.classification === 'phishing' ? 'high' : 'medium',
          identity_provider: identity_context?.provider || 'internal',
          identity_context: identity_context || {},
        });
      }
      triaged++;
    }

    await supabase.from('agent_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      summary: `Triaged ${triaged} abuse reports, ${matchingThreats?.length || 0} cross-referenced hits`,
      items_processed: pendingItems.length, items_flagged: triaged,
      results: { ...results, triaged, cross_references: matchingThreats?.length || 0 },
    }).eq('id', run_id);

    return new Response(JSON.stringify({ success: true, triaged }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('agent-abuse-mailbox error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

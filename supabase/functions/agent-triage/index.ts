/**
 * agent-triage — AI Triage Agent
 * Auto-classifies, deduplicates, and prioritizes incoming threats.
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

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { run_id } = await req.json();

    // Update run status
    await supabase.from('agent_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', run_id);

    // Fetch recent unprocessed threats (last 24h, active status)
    const { data: threats } = await supabase
      .from('threats')
      .select('id, brand, domain, attack_type, severity, confidence, source, country, ip_address, first_seen, last_seen, metadata')
      .eq('status', 'active')
      .gte('last_seen', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('last_seen', { ascending: false })
      .limit(200);

    if (!threats?.length) {
      await supabase.from('agent_runs').update({
        status: 'completed', completed_at: new Date().toISOString(),
        summary: 'No new threats to triage in the last 24 hours.',
        items_processed: 0, items_flagged: 0, results: { findings: [] },
      }).eq('id', run_id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Serialize threats for AI
    const threatList = threats.slice(0, 100).map(t =>
      `${t.brand}|${t.domain}|${t.attack_type}|${t.severity}|${t.confidence}%|${t.source}|${t.country || 'N/A'}|${t.ip_address || 'N/A'}`
    ).join('\n');

    const systemPrompt = `You are an automated threat triage agent for a phishing defense platform. Analyze the threat list and return JSON:
{
  "priority_queue": [
    {"domain": "x.com", "brand": "X", "recommended_severity": "critical|high|medium|low", "reason": "brief reason", "deduplicate_with": ["similar.com"] or null, "action": "escalate|investigate|monitor|dismiss"}
  ],
  "duplicates_found": [{"group": ["domain1.com","domain2.com"], "reason": "why they're duplicates"}],
  "summary": "1-2 sentence overview of triage results",
  "stats": {"total_reviewed": N, "escalated": N, "duplicates": N, "dismissed": N}
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
          { role: 'user', content: `Triage these ${threats.length} active threats from the last 24h:\n${threatList}` },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const status = resp.status;
      const errBody = await resp.text();
      console.error('AI error:', status, errBody);
      await supabase.from('agent_runs').update({
        status: 'failed', completed_at: new Date().toISOString(),
        error_message: status === 429 ? 'Rate limited' : status === 402 ? 'Credits exhausted' : `AI error ${status}`,
      }).eq('id', run_id);
      return new Response(JSON.stringify({ success: false, error: `AI error ${status}` }), {
        status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await resp.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    let results;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      results = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim());
    } catch {
      results = { summary: content, priority_queue: [], duplicates_found: [], stats: {} };
    }

    await supabase.from('agent_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      summary: results.summary || `Triaged ${threats.length} threats`,
      items_processed: threats.length,
      items_flagged: results.stats?.escalated || results.priority_queue?.filter((p: any) => p.action === 'escalate').length || 0,
      results,
    }).eq('id', run_id);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('agent-triage error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

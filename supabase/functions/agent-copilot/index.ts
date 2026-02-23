/**
 * agent-copilot — Enhanced Chat Copilot with tool-calling
 * Upgrades ThreatChat with ability to query DB, create tickets, and generate bulletins.
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
    const { run_id, action, params } = await req.json();

    await supabase.from('agent_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', run_id);

    // Tool execution based on action
    let toolResult: any = {};

    if (action === 'query_threats') {
      const { brand, severity, limit: lim } = params || {};
      let query = supabase.from('threats').select('brand, domain, attack_type, severity, confidence, source, country, ip_address, first_seen, last_seen');
      if (brand) query = query.ilike('brand', `%${brand}%`);
      if (severity) query = query.eq('severity', severity);
      const { data } = await query.order('last_seen', { ascending: false }).limit(lim || 20);
      toolResult = { type: 'query_threats', data, count: data?.length || 0 };
    }
    else if (action === 'create_ticket') {
      const { title, description, severity: sev, tags } = params || {};
      const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase.from('investigation_tickets').insert({
        ticket_id: ticketId, title, description,
        severity: sev || 'medium', priority: sev === 'critical' ? 'critical' : 'high',
        source_type: 'copilot_agent', source_id: run_id,
        tags: tags || ['ai-generated'],
      }).select().single();
      toolResult = { type: 'create_ticket', ticket: data, error: error?.message };
    }
    else if (action === 'generate_bulletin') {
      const { brand, threat_summary } = params || {};
      const { data: threats } = await supabase.from('threats')
        .select('domain, ip_address, attack_type, severity, source')
        .ilike('brand', `%${brand}%`).order('last_seen', { ascending: false }).limit(20);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: 'Generate a TLP:AMBER intelligence bulletin for the specified brand. Include: executive summary, IOC list, recommended actions, and MITRE mappings. Format as professional markdown.' },
            { role: 'user', content: `Brand: ${brand}\nContext: ${threat_summary || ''}\nActive IOCs: ${JSON.stringify(threats || [])}` },
          ],
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (resp.ok) {
        const aiData = await resp.json();
        toolResult = { type: 'generate_bulletin', bulletin: aiData.choices?.[0]?.message?.content || '', brand };
      } else {
        await resp.text();
        toolResult = { type: 'generate_bulletin', error: `AI error ${resp.status}` };
      }
    }
    else if (action === 'scan_domain') {
      const { domain } = params || {};
      const { data } = await supabase.from('threats')
        .select('*').ilike('domain', `%${domain}%`).limit(10);
      toolResult = { type: 'scan_domain', domain, threats_found: data?.length || 0, threats: data };
    }
    else {
      toolResult = { type: 'unknown', error: `Unknown action: ${action}` };
    }

    await supabase.from('agent_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      summary: `Copilot executed: ${action}`,
      items_processed: 1, items_flagged: 0, results: toolResult,
    }).eq('id', run_id);

    return new Response(JSON.stringify({ success: true, results: toolResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('agent-copilot error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

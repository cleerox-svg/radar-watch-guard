/**
 * agent-hunt — Threat Hunt Agent
 * Proactively correlates across all feeds to find campaign clusters and patterns.
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

    // ─── Authenticate user ───
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { run_id } = await req.json();

    await supabase.from('agent_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', run_id);

    // Parallel fetch from multiple feeds
    const [{ data: threats }, { data: socialIocs }, { data: torNodes }, { data: news }] = await Promise.all([
      supabase.from('threats').select('brand, domain, attack_type, severity, source, country, ip_address, first_seen')
        .order('last_seen', { ascending: false }).limit(150),
      supabase.from('social_iocs').select('ioc_type, ioc_value, source, tags, date_shared')
        .order('date_shared', { ascending: false }).limit(50),
      supabase.from('tor_exit_nodes').select('ip_address').limit(50),
      supabase.from('threat_news').select('title, cve_id, severity, vendor, product')
        .order('date_published', { ascending: false }).limit(20),
    ]);

    const torIps = new Set((torNodes || []).map(n => n.ip_address));
    const torOverlap = (threats || []).filter(t => t.ip_address && torIps.has(t.ip_address));

    const systemPrompt = `You are a threat hunting agent analyzing cross-feed intelligence for a phishing defense platform. Find campaign clusters, infrastructure overlaps, and emerging patterns. Return JSON:
{
  "campaigns": [
    {"name": "campaign name", "confidence": "high|medium|low", "indicators": ["domain1","domain2"], "brands_targeted": ["Brand"], "infrastructure_pattern": "description", "recommendation": "action"}
  ],
  "infrastructure_overlaps": [
    {"pattern": "description", "domains": ["d1","d2"], "shared_ip": "ip or null", "tor_linked": bool}
  ],
  "emerging_patterns": [
    {"pattern": "description", "evidence": "what data shows this", "risk_level": "critical|high|medium", "recommendation": "action"}
  ],
  "tor_connections": {"count": N, "domains": ["d1"]},
  "summary": "2-3 sentence executive summary of hunt findings"
}
Only return valid JSON.`;

    const threatData = (threats || []).slice(0, 100).map(t =>
      `${t.brand}|${t.domain}|${t.attack_type}|${t.severity}|${t.source}|${t.country || ''}|${t.ip_address || ''}`
    ).join('\n');

    const iocData = (socialIocs || []).slice(0, 30).map(s =>
      `${s.ioc_type}:${s.ioc_value}|${s.source}|${(s.tags || []).join(',')}`
    ).join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Hunt across this data:\n\nTHREATS (${threats?.length || 0}):\n${threatData}\n\nSOCIAL IOCs (${socialIocs?.length || 0}):\n${iocData}\n\nTOR OVERLAPS: ${torOverlap.length} threats on Tor exit nodes\nKEVs: ${(news || []).map(n => `${n.cve_id || ''} ${n.vendor || ''}`).join(', ')}` },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      const errBody = await resp.text();
      console.error('AI error:', resp.status, errBody);
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
      results = { summary: content, campaigns: [], infrastructure_overlaps: [], emerging_patterns: [] };
    }

    const flagged = (results.campaigns?.length || 0) + (results.emerging_patterns?.length || 0);
    await supabase.from('agent_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      summary: results.summary || 'Hunt completed',
      items_processed: (threats?.length || 0) + (socialIocs?.length || 0),
      items_flagged: flagged, results,
    }).eq('id', run_id);

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('agent-hunt error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

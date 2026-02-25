/**
 * agent-campaign — Fraud Campaign Correlator Agent
 * Clusters related threats by shared infrastructure (IP, ASN, registrar, SSL issuer).
 * Creates campaign clusters for analyst confirmation.
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

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { run_id, identity_context } = await req.json();

    await supabase.from('agent_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', run_id);

    // Fetch active threats with infrastructure data
    const { data: threats } = await supabase.from('threats')
      .select('id, brand, domain, ip_address, isp, asn, org_name, country, attack_type, severity, confidence, source')
      .eq('status', 'active')
      .order('last_seen', { ascending: false })
      .limit(200);

    if (!threats?.length) {
      await supabase.from('agent_runs').update({
        status: 'completed', completed_at: new Date().toISOString(),
        summary: 'No active threats to correlate.',
        items_processed: 0, items_flagged: 0, results: { campaigns: [] },
      }).eq('id', run_id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const threatData = threats.map(t =>
      `${t.id}|${t.brand}|${t.domain}|${t.ip_address || ''}|${t.isp || ''}|${t.asn || ''}|${t.org_name || ''}|${t.country || ''}|${t.attack_type}|${t.severity}`
    ).join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: `You are a fraud campaign correlation agent. Analyze threats and cluster them by shared infrastructure patterns. Return JSON:
{
  "campaigns": [
    {
      "name": "Campaign name",
      "description": "What connects these threats",
      "threat_ids": ["uuid1", "uuid2"],
      "infrastructure_pattern": {"shared_ip": "...", "shared_asn": "...", "shared_registrar": "..."},
      "confidence_score": 0-100,
      "brands_targeted": ["brand1", "brand2"],
      "priority": "critical|high|medium",
      "recommended_action": "bulk_takedown|monitor|investigate"
    }
  ],
  "summary": "overview of discovered campaigns"
}
Only return valid JSON.` },
          { role: 'user', content: `Cluster these ${threats.length} threats by infrastructure:\n${threatData}` },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    let results: any = { campaigns: [] };
    if (resp.ok) {
      const aiData = await resp.json();
      const content = aiData.choices?.[0]?.message?.content || '';
      try {
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        results = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim());
      } catch { results = { campaigns: [], summary: content.slice(0, 500) }; }
    } else { await resp.text(); }

    // Create campaign clusters and approvals
    let clustersCreated = 0;
    for (const campaign of (results.campaigns || []).slice(0, 10)) {
      const { data: cluster, error } = await supabase.from('campaign_clusters').insert({
        campaign_name: campaign.name,
        description: campaign.description,
        threat_ids: campaign.threat_ids || [],
        infrastructure_pattern: campaign.infrastructure_pattern || {},
        confidence_score: campaign.confidence_score || 0,
        brands_targeted: campaign.brands_targeted || [],
        priority: campaign.priority || 'medium',
        ioc_count: campaign.threat_ids?.length || 0,
        identity_provider: identity_context?.provider || 'internal',
      }).select().single();

      if (!error && cluster) {
        clustersCreated++;
        // Create approval for analyst to confirm campaign
        await supabase.from('agent_approvals').insert({
          agent_run_id: run_id,
          agent_type: 'campaign',
          action_type: 'campaign_tag',
          title: `Campaign: ${campaign.name}`,
          description: campaign.description,
          payload: { ...campaign, cluster_id: cluster.id },
          priority: campaign.priority || 'medium',
          identity_provider: identity_context?.provider || 'internal',
          identity_context: identity_context || {},
        });
      }
    }

    await supabase.from('agent_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      summary: `Identified ${clustersCreated} fraud campaigns from ${threats.length} threats`,
      items_processed: threats.length, items_flagged: clustersCreated,
      results: { ...results, clusters_created: clustersCreated },
    }).eq('id', run_id);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('agent-campaign error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

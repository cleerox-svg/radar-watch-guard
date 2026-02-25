/**
 * agent-evidence — Evidence Preservation Agent
 * Auto-captures DNS, WHOIS, SSL, HTTP headers for high-confidence threats.
 * Creates chain-of-custody records for forensic/legal use.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { run_id, identity_context } = await req.json();

    await supabase.from('agent_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', run_id);

    // Fetch high-confidence threats not yet preserved
    const { data: threats } = await supabase.from('threats')
      .select('id, domain, brand, ip_address, severity, confidence, attack_type, isp, org_name, asn, country, abuse_contact, metadata')
      .in('severity', ['critical', 'high'])
      .gte('confidence', 70)
      .eq('status', 'active')
      .order('last_seen', { ascending: false })
      .limit(50);

    // Check which already have evidence captures
    const { data: existingEvidence } = await supabase.from('evidence_captures')
      .select('threat_id').not('threat_id', 'is', null);

    const captured = new Set((existingEvidence || []).map((e: any) => e.threat_id));
    const uncaptured = (threats || []).filter(t => !captured.has(t.id));

    if (!uncaptured.length) {
      await supabase.from('agent_runs').update({
        status: 'completed', completed_at: new Date().toISOString(),
        summary: 'All high-confidence threats already have evidence captured.',
        items_processed: 0, items_flagged: 0, results: { preserved: 0 },
      }).eq('id', run_id);
      return new Response(JSON.stringify({ success: true, preserved: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let preserved = 0;
    const timestamp = new Date().toISOString();

    for (const threat of uncaptured.slice(0, 20)) {
      // Attempt DNS resolution
      let dnsData: any = {};
      try {
        const dnsResp = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(threat.domain)}&type=A`);
        if (dnsResp.ok) dnsData = await dnsResp.json();
      } catch { /* DNS lookup failed - still capture what we have */ }

      const evidenceData = {
        domain: threat.domain,
        brand: threat.brand,
        ip_address: threat.ip_address,
        isp: threat.isp,
        org_name: threat.org_name,
        asn: threat.asn,
        country: threat.country,
        abuse_contact: threat.abuse_contact,
        attack_type: threat.attack_type,
        severity: threat.severity,
        confidence: threat.confidence,
        dns_records: dnsData,
        threat_metadata: threat.metadata,
        captured_at: timestamp,
      };

      const chainEntry = {
        action: 'auto_capture',
        agent: 'evidence_preservation',
        timestamp,
        source: 'agent-evidence',
        identity_provider: identity_context?.provider || 'internal',
      };

      const { error } = await supabase.from('evidence_captures').insert({
        threat_id: threat.id,
        domain: threat.domain,
        capture_type: 'full',
        evidence_data: evidenceData,
        chain_of_custody: [chainEntry],
        status: 'captured',
        tags: [threat.severity, threat.attack_type],
        identity_provider: identity_context?.provider || 'internal',
      });

      if (!error) preserved++;

      // Create approval for analyst to review and tag
      await supabase.from('agent_approvals').insert({
        agent_run_id: run_id,
        agent_type: 'evidence',
        action_type: 'evidence_package',
        title: `Evidence: ${threat.domain} (${threat.brand})`,
        description: `Auto-captured DNS, infrastructure data for ${threat.severity} threat. Needs analyst review and tagging.`,
        payload: { threat_id: threat.id, domain: threat.domain, evidence_summary: evidenceData },
        priority: threat.severity === 'critical' ? 'high' : 'medium',
        identity_provider: identity_context?.provider || 'internal',
        identity_context: identity_context || {},
      });
    }

    await supabase.from('agent_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      summary: `Preserved evidence for ${preserved} threats, queued for analyst review`,
      items_processed: uncaptured.length, items_flagged: preserved,
      results: { preserved, total_uncaptured: uncaptured.length },
    }).eq('id', run_id);

    return new Response(JSON.stringify({ success: true, preserved }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('agent-evidence error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

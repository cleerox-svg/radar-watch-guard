/**
 * agent-trust-monitor — Trust Score Degradation Alert Agent
 * Continuously recalculates brand trust scores. Alerts on significant drops.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculateTrustScore(threats: any[], brand: string) {
  const brandThreats = threats.filter(t => t.brand?.toLowerCase() === brand.toLowerCase());
  if (!brandThreats.length) return { score: 95, grade: 'A', factors: {} };

  let score = 100;
  const factors: Record<string, number> = {};

  // Severity penalties
  const critical = brandThreats.filter(t => t.severity === 'critical').length;
  const high = brandThreats.filter(t => t.severity === 'high').length;
  const medium = brandThreats.filter(t => t.severity === 'medium').length;

  factors.critical_threats = critical * -8;
  factors.high_threats = high * -4;
  factors.medium_threats = medium * -2;

  score += factors.critical_threats + factors.high_threats + factors.medium_threats;

  // Active threat volume penalty
  if (brandThreats.length > 20) factors.high_volume = -10;
  else if (brandThreats.length > 10) factors.high_volume = -5;
  else factors.high_volume = 0;
  score += factors.high_volume;

  // High confidence threats penalty
  const highConf = brandThreats.filter(t => t.confidence >= 80).length;
  factors.high_confidence = highConf * -3;
  score += factors.high_confidence;

  score = Math.max(0, Math.min(100, score));

  let grade = 'A+';
  if (score < 30) grade = 'F';
  else if (score < 45) grade = 'D';
  else if (score < 55) grade = 'C';
  else if (score < 65) grade = 'C+';
  else if (score < 75) grade = 'B';
  else if (score < 85) grade = 'B+';
  else if (score < 92) grade = 'A';

  return { score, grade, factors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { run_id, identity_context } = await req.json();

    await supabase.from('agent_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', run_id);

    // Get all active threats
    const { data: threats } = await supabase.from('threats')
      .select('brand, severity, confidence, status')
      .eq('status', 'active');

    // Get unique brands
    const brands = [...new Set((threats || []).map(t => t.brand).filter(Boolean))];

    // Get previous scores for comparison
    const { data: prevScores } = await supabase.from('trust_score_history')
      .select('brand, score, created_at')
      .order('created_at', { ascending: false })
      .limit(brands.length * 2);

    const prevScoreMap = new Map<string, number>();
    for (const ps of (prevScores || [])) {
      if (!prevScoreMap.has(ps.brand)) prevScoreMap.set(ps.brand, ps.score);
    }

    let alertsCreated = 0;
    const scoreSummaries: any[] = [];

    for (const brand of brands) {
      const { score, grade, factors } = calculateTrustScore(threats || [], brand);
      const prevScore = prevScoreMap.get(brand);
      const delta = prevScore !== undefined ? score - prevScore : 0;

      // Save score history
      await supabase.from('trust_score_history').insert({
        brand, score, grade, delta, factors,
        alert_triggered: delta <= -10,
      });

      scoreSummaries.push({ brand, score, grade, delta });

      // Alert if score dropped significantly
      if (delta <= -10) {
        alertsCreated++;
        await supabase.from('agent_approvals').insert({
          agent_run_id: run_id,
          agent_type: 'trust_monitor',
          action_type: 'trust_alert',
          title: `Trust Drop: ${brand} (${prevScore}→${score}, ${grade})`,
          description: `Trust score dropped ${Math.abs(delta)} points in recent period. Factors: ${Object.entries(factors).filter(([,v]) => v < 0).map(([k,v]) => `${k}: ${v}`).join(', ')}`,
          payload: { brand, score, grade, delta, factors, previous_score: prevScore },
          priority: delta <= -20 ? 'critical' : 'high',
          identity_provider: identity_context?.provider || 'internal',
          identity_context: identity_context || {},
        });
      }
    }

    await supabase.from('agent_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      summary: `Scored ${brands.length} brands, ${alertsCreated} trust degradation alerts`,
      items_processed: brands.length, items_flagged: alertsCreated,
      results: { scores: scoreSummaries, alerts: alertsCreated },
    }).eq('id', run_id);

    return new Response(JSON.stringify({ success: true, brands_scored: brands.length, alerts: alertsCreated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('agent-trust-monitor error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

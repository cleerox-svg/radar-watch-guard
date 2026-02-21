/**
 * analyze-threat — Supabase Edge Function
 *
 * Takes a single threat record and generates an AI-powered deep dive:
 *   - MITRE ATT&CK technique mapping
 *   - Similar campaign identification
 *   - Risk assessment
 *   - Specific mitigation recommendations
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { threat } = await req.json();
    if (!threat) throw new Error('No threat data provided');

    // Fetch similar threats (same brand or attack type)
    const { data: similar } = await supabase
      .from('threats')
      .select('brand, domain, attack_type, severity, source, country, first_seen')
      .or(`brand.eq.${threat.brand},attack_type.eq.${threat.attack_type}`)
      .neq('id', threat.id)
      .order('last_seen', { ascending: false })
      .limit(10);

    const similarSummary = (similar || []).map(t =>
      `${t.brand} | ${t.domain} | ${t.attack_type} | ${t.severity} | ${t.source}`
    ).join('\n');

    const systemPrompt = `You are a senior threat intelligence analyst specializing in phishing and brand impersonation attacks. Analyze the provided IOC and return a structured JSON analysis.

Return ONLY valid JSON matching this structure:
{
  "risk_level": "critical|high|medium|low",
  "risk_summary": "One paragraph risk assessment",
  "mitre_techniques": [
    {"id": "T1566.001", "name": "Spearphishing Attachment", "relevance": "How this applies"}
  ],
  "campaign_analysis": {
    "likely_campaign": "Campaign name or 'Isolated incident'",
    "related_domains_count": number,
    "actor_profile": "Known threat actor or 'Unattributed'",
    "infrastructure_notes": "TLD patterns, hosting, registration"
  },
  "target_analysis": {
    "brand_at_risk": "Brand name",
    "attack_goal": "Credential harvesting, malware delivery, etc.",
    "victim_profile": "Who is targeted",
    "geographic_focus": "Region or 'Global'"
  },
  "mitigations": [
    {"action": "Specific action", "priority": "immediate|short_term|ongoing", "detail": "How to implement"}
  ],
  "ioc_enrichment": {
    "domain_age_estimate": "Likely recently registered or established",
    "hosting_pattern": "Free hosting, bulletproof, cloud, etc.",
    "ssl_likelihood": "Likely uses free SSL to appear legitimate"
  }
}`;

    const userPrompt = `Analyze this threat IOC:

Brand: ${threat.brand}
Domain: ${threat.domain}
Attack Type: ${threat.attack_type}
Severity: ${threat.severity || 'unknown'}
Confidence: ${threat.confidence}%
Source Feed: ${threat.source || 'unknown'}
Country: ${threat.country || 'Unknown'}
IP: ${threat.ip_address || 'Not resolved'}
First Seen: ${threat.first_seen || 'Unknown'}
Last Seen: ${threat.last_seen || 'Unknown'}
Metadata: ${JSON.stringify(threat.metadata || {})}

Similar threats in our database (${similar?.length || 0} found):
${similarSummary || 'None found'}

Provide a thorough analysis with MITRE ATT&CK mapping, campaign attribution assessment, and prioritized mitigations.`;

    const models = ['google/gemini-2.5-flash-lite', 'google/gemini-2.5-flash', 'openai/gpt-5-mini'];
    let content = '';
    const maxRetries = 2;
    const timeoutMs = 25000;

    for (const model of models) {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);

          const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            }),
            signal: controller.signal,
          });

          clearTimeout(timer);

          if (resp.ok) {
            const aiData = await resp.json();
            content = aiData.choices?.[0]?.message?.content || '';
            break;
          }

          if (resp.status === 429) {
            return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded. Try again shortly.' }), {
              status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          if (resp.status === 402) {
            return new Response(JSON.stringify({ success: false, error: 'AI credits exhausted.' }), {
              status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          const errBody = await resp.text();
          console.error(`Model ${model} attempt ${attempt + 1} failed (${resp.status}):`, errBody);
        } catch (fetchErr) {
          console.error(`Model ${model} attempt ${attempt + 1} error:`, fetchErr);
        }
      }
      if (content) break;
    }

    if (!content) {
      return new Response(JSON.stringify({ success: false, error: 'AI analysis temporarily unavailable. Please try again in a moment.' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let analysis;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      analysis = JSON.parse(jsonStr);
    } catch {
      analysis = { risk_summary: content, mitre_techniques: [], mitigations: [], campaign_analysis: {}, target_analysis: {}, ioc_enrichment: {} };
    }

    return new Response(
      JSON.stringify({ success: true, analysis }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Threat analysis error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

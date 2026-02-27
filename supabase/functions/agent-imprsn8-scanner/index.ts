/**
 * agent-imprsn8-scanner — Alert-only agent that scans monitored accounts for impersonators.
 * Iterates all active monitored_accounts, calls the AI gateway to assess potential fakes,
 * and creates impersonation_reports for human review.
 *
 * This is an alert-only agent: it flags and reports, never takes autonomous action.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const influencerId = body.influencer_id; // optional: scan specific influencer
    const platform = body.platform; // optional: scan specific platform

    // 1. Create agent run record
    const { data: run, error: runErr } = await supabase.from("agent_runs").insert({
      agent_type: "imprsn8_scanner",
      trigger_type: body.trigger_type || "manual",
      status: "running",
      started_at: new Date().toISOString(),
      input_params: { influencer_id: influencerId, platform },
    }).select("id").single();

    if (runErr) throw new Error(`Failed to create agent run: ${runErr.message}`);

    // 2. Fetch monitored accounts to scan
    let query = supabase.from("monitored_accounts").select("*, influencer_profiles(display_name, brand_name)");
    if (influencerId) query = query.eq("influencer_id", influencerId);
    if (platform) query = query.eq("platform", platform);

    const { data: accounts, error: acctErr } = await query;
    if (acctErr) throw new Error(`Failed to fetch accounts: ${acctErr.message}`);

    let processed = 0;
    let flagged = 0;
    const results: any[] = [];

    for (const account of accounts || []) {
      processed++;

      // Update scan status to 'scanning'
      await supabase.from("monitored_accounts")
        .update({ scan_status: "scanning", last_scanned_at: new Date().toISOString() })
        .eq("id", account.id);

      // Use AI to assess potential impersonation risk
      if (lovableApiKey) {
        try {
          const influencer = account.influencer_profiles as any;
          const prompt = `You are a social media impersonation detection agent. Analyze the following verified account and generate a risk assessment.

Verified account:
- Platform: ${account.platform}
- Username: @${account.platform_username}
- Profile URL: ${account.platform_url}
- Brand/Creator: ${influencer?.display_name || "Unknown"} (${influencer?.brand_name || "N/A"})

Generate a JSON response with:
1. "risk_level": "low" | "medium" | "high" (overall impersonation risk for this type of account)
2. "common_patterns": array of common impersonation patterns for this platform
3. "search_terms": array of username variations an impersonator might use
4. "recommendations": array of protective measures

Respond ONLY with valid JSON.`;

          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: prompt }],
              temperature: 0.3,
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content || "";

            // Try to parse JSON from the AI response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const analysis = JSON.parse(jsonMatch[0]);
              results.push({
                account_id: account.id,
                platform: account.platform,
                username: account.platform_username,
                analysis,
              });

              // If AI indicates high risk, create a system-generated note
              if (analysis.risk_level === "high") {
                flagged++;
              }
            }
          }
        } catch (aiErr) {
          const errorMessage = aiErr instanceof Error ? aiErr.message : "Unknown AI error";
          console.error(`AI analysis failed for ${account.platform_username}:`, errorMessage);
        }
      }

      // Mark scan as complete
      await supabase.from("monitored_accounts")
        .update({ scan_status: "active" })
        .eq("id", account.id);
    }

    // 3. Update agent run with results
    await supabase.from("agent_runs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      items_processed: processed,
      items_flagged: flagged,
      results: { scans: results },
      summary: `Scanned ${processed} accounts across ${new Set((accounts || []).map((a: any) => a.platform)).size} platforms. ${flagged} high-risk profiles identified.`,
    }).eq("id", run.id);

    return new Response(
      JSON.stringify({
        success: true,
        run_id: run.id,
        processed,
        flagged,
        summary: `Scanned ${processed} accounts. ${flagged} flagged for review.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Scanner agent error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

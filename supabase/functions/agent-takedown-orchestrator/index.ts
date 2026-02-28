/**
 * agent-takedown-orchestrator — Automates platform-specific takedown workflows.
 * Generates DMCA notices, tracks platform response SLAs, and escalates stalled cases.
 *
 * Interval: Every 1 hour (lightweight — mostly DB reads + AI generation)
 * Autonomy: Semi-autonomous with HITL for final submission
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Platform-specific SLA windows (hours) */
const PLATFORM_SLAS: Record<string, number> = {
  twitter: 48, x: 48, instagram: 72, tiktok: 48, youtube: 72,
};

/** Generate a DMCA notice template via AI */
async function generateDMCA(report: any, influencer: any, aiKey: string): Promise<string | null> {
  const prompt = `Generate a professional DMCA takedown notice for a social media impersonation case.

Claimant: ${influencer.display_name} (Brand: ${influencer.brand_name || influencer.display_name})
Platform: ${report.platform}
Impersonator account: @${report.impersonator_username} (${report.impersonator_url || "URL not available"})
Similarity score: ${report.similarity_score}%
Evidence: ${JSON.stringify((report.ai_analysis as any)?.match_reasons || [])}

Generate a formal DMCA takedown notice following platform requirements. Include:
1. Identification of the copyrighted work (brand identity, profile content)
2. Identification of the infringing material
3. Contact information placeholder
4. Good faith statement
5. Accuracy statement

Return the complete notice text ready for submission.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${aiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: prompt }], temperature: 0.2 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const aiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const body = await req.json().catch(() => ({}));

    const { data: run } = await supabase.from("agent_runs").insert({
      agent_type: "takedown_orchestrator",
      trigger_type: body.trigger_type || "manual",
      status: "running",
      started_at: new Date().toISOString(),
      input_params: body,
    }).select("id").single();

    let processed = 0, flagged = 0;

    // ── Task 1: Generate DMCA for confirmed high/critical reports without takedown requests ──
    const { data: confirmedReports } = await supabase.from("impersonation_reports")
      .select("*, influencer_profiles(display_name, brand_name, report_email)")
      .in("status", ["confirmed"])
      .in("severity", ["critical", "high"])
      .order("created_at", { ascending: true })
      .limit(10);

    for (const report of confirmedReports || []) {
      processed++;
      const inf = report.influencer_profiles as any;

      // Check if takedown request already exists
      const { data: existingTakedown } = await supabase.from("takedown_requests")
        .select("id").eq("report_id", report.id).maybeSingle();

      if (!existingTakedown) {
        // Generate DMCA notice
        const dmca = await generateDMCA(report, inf, aiKey);

        // Create takedown request (pending approval)
        await supabase.from("takedown_requests").insert({
          influencer_id: report.influencer_id,
          report_id: report.id,
          platform: report.platform,
          request_type: "dmca",
          status: "draft",
          notes: dmca || "DMCA generation failed — manual review required",
          response_data: { auto_generated: true, run_id: run?.id, similarity_score: report.similarity_score },
        });

        // Create HITL approval entry
        await supabase.from("agent_approvals").insert({
          agent_type: "takedown_orchestrator",
          agent_run_id: run?.id,
          action_type: "submit_takedown",
          title: `Takedown: @${report.impersonator_username} on ${report.platform}`,
          description: `Auto-generated DMCA for impersonator with ${report.similarity_score}% similarity to ${inf?.display_name}`,
          payload: { report_id: report.id, platform: report.platform, impersonator: report.impersonator_username },
          priority: report.severity === "critical" ? "critical" : "high",
          status: "pending",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        flagged++;
      }
    }

    // ── Task 2: Check SLA compliance on submitted takedowns ──
    const { data: pendingTakedowns } = await supabase.from("takedown_requests")
      .select("*")
      .in("status", ["submitted", "acknowledged"])
      .not("submitted_at", "is", null);

    for (const td of pendingTakedowns || []) {
      processed++;
      const slaHours = PLATFORM_SLAS[td.platform.toLowerCase()] || 72;
      const submittedAt = new Date(td.submitted_at!).getTime();
      const elapsed = (Date.now() - submittedAt) / (1000 * 60 * 60);

      if (elapsed > slaHours && td.status !== "escalated") {
        // SLA breached — escalate
        await supabase.from("takedown_requests").update({
          status: "escalated",
          response_data: {
            ...(td.response_data as any || {}),
            sla_breached: true,
            sla_hours: slaHours,
            elapsed_hours: Math.round(elapsed),
            escalated_at: new Date().toISOString(),
            escalated_by_run: run?.id,
          },
        }).eq("id", td.id);
        flagged++;
      }
    }

    await supabase.from("agent_runs").update({
      status: "completed", completed_at: new Date().toISOString(),
      items_processed: processed, items_flagged: flagged,
      summary: `Processed ${processed} items. ${flagged} new takedown drafts/escalations created.`,
    }).eq("id", run?.id);

    return new Response(JSON.stringify({ success: true, run_id: run?.id, processed, flagged }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Takedown Orchestrator error:", error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * report-impersonator — Public endpoint for crowd-sourced impersonation reports.
 * Followers can submit reports without authentication using the influencer's widget_token.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const {
      widget_token,
      platform,
      impersonator_username,
      impersonator_url,
      reporter_email,
      reporter_description,
    } = await req.json();

    if (!widget_token || !platform || !impersonator_username) {
      return new Response(
        JSON.stringify({ error: "widget_token, platform, and impersonator_username are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the influencer by widget_token
    const { data: influencer, error: infErr } = await supabase
      .from("influencer_profiles")
      .select("id, display_name")
      .eq("widget_token", widget_token)
      .maybeSingle();

    if (infErr || !influencer) {
      return new Response(
        JSON.stringify({ error: "Invalid widget token" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate report
    const { data: existing } = await supabase.from("impersonation_reports")
      .select("id")
      .eq("influencer_id", influencer.id)
      .eq("impersonator_username", impersonator_username)
      .eq("platform", platform)
      .eq("source", "follower_report")
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: "Report already submitted. Thank you!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the report
    const { error: insertErr } = await supabase.from("impersonation_reports").insert({
      influencer_id: influencer.id,
      platform,
      impersonator_username,
      impersonator_url: impersonator_url || null,
      reporter_email: reporter_email || null,
      reporter_description: reporter_description || null,
      source: "follower_report",
      status: "pending",
      severity: "medium",
    });

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Thank you for reporting a potential impersonator of ${influencer.display_name}. We'll investigate shortly.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Report impersonator error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

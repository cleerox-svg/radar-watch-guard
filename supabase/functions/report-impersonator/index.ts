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

const VALID_PLATFORMS = ["instagram", "twitter", "facebook", "tiktok", "youtube", "linkedin", "threads", "x"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    // ─── Required fields ───
    if (!widget_token || !platform || !impersonator_username) {
      return new Response(
        JSON.stringify({ error: "widget_token, platform, and impersonator_username are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Type validation ───
    if (typeof widget_token !== "string" || typeof platform !== "string" || typeof impersonator_username !== "string") {
      return new Response(
        JSON.stringify({ error: "Invalid input types" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Length validation ───
    if (widget_token.length > 200 || impersonator_username.length > 100 ||
        (impersonator_url && (typeof impersonator_url !== "string" || impersonator_url.length > 500)) ||
        (reporter_email && (typeof reporter_email !== "string" || reporter_email.length > 255)) ||
        (reporter_description && (typeof reporter_description !== "string" || reporter_description.length > 2000))) {
      return new Response(
        JSON.stringify({ error: "Input exceeds maximum length" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Platform whitelist ───
    if (!VALID_PLATFORMS.includes(platform.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: "Invalid platform. Supported: " + VALID_PLATFORMS.join(", ") }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Email format validation ───
    if (reporter_email && !EMAIL_REGEX.test(reporter_email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── URL format validation ───
    if (impersonator_url) {
      try {
        new URL(impersonator_url);
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid URL format for impersonator_url" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Sanitize inputs
    const sanitizedUsername = impersonator_username.trim().substring(0, 100);
    const sanitizedDescription = reporter_description?.trim().substring(0, 2000) || null;
    const sanitizedEmail = reporter_email?.trim().substring(0, 255) || null;
    const sanitizedUrl = impersonator_url?.trim().substring(0, 500) || null;

    // Look up the influencer by widget_token
    const { data: influencer, error: infErr } = await supabase
      .from("influencer_profiles")
      .select("id, display_name")
      .eq("widget_token", widget_token.trim())
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
      .eq("impersonator_username", sanitizedUsername)
      .eq("platform", platform.toLowerCase())
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
      platform: platform.toLowerCase(),
      impersonator_username: sanitizedUsername,
      impersonator_url: sanitizedUrl,
      reporter_email: sanitizedEmail,
      reporter_description: sanitizedDescription,
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
    console.error("Report impersonator error:", error instanceof Error ? error.message : "Unknown error");
    return new Response(
      JSON.stringify({ error: "An error occurred processing your report" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

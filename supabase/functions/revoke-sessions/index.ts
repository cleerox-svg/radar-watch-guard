/**
 * revoke-sessions — Admin force-logout & ATO auto-revoke edge function.
 *
 * Endpoints:
 *   POST { action: "force_logout", target_user_id: string }
 *     — Admin revokes all sessions for a user
 *
 *   POST { action: "ato_auto_revoke", user_email: string, risk_score: number }
 *     — Automatically triggered when a high-risk ATO event is detected
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin (except for internal ATO triggers)
    const authHeader = req.headers.get("authorization");
    const { action, target_user_id, user_email, risk_score } = await req.json();

    if (action === "force_logout") {
      // Verify admin role
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const token = authHeader.replace("Bearer ", "");
      const { data: { user: caller } } = await supabase.auth.getUser(token);
      if (!caller) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check admin role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .eq("role", "admin")
        .single();

      if (!roleData) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "target_user_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Revoke all sessions via Admin API
      const { error: signOutError } = await supabase.auth.admin.signOut(target_user_id, "global");

      // Mark revoked_at on profile
      await supabase
        .from("profiles")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", target_user_id);

      // Log session event
      await supabase.from("session_events").insert({
        user_id: target_user_id,
        event_type: "force_logout",
        metadata: { revoked_by: caller.id },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `All sessions revoked for user ${target_user_id}`,
          error: signOutError?.message || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "ato_auto_revoke") {
      if (!user_email) {
        return new Response(JSON.stringify({ error: "user_email required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const threshold = 80; // Risk score threshold for auto-revoke
      if ((risk_score || 0) < threshold) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Risk score ${risk_score} below auto-revoke threshold (${threshold})`,
            action_taken: false,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find user by email
      const { data: userData } = await supabase.auth.admin.listUsers();
      const targetUser = userData?.users?.find((u: any) => u.email === user_email);

      if (!targetUser) {
        return new Response(
          JSON.stringify({ success: false, message: "User not found", action_taken: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Revoke sessions
      const { error: signOutError } = await supabase.auth.admin.signOut(targetUser.id, "global");

      // Mark revoked_at
      await supabase
        .from("profiles")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", targetUser.id);

      // Log session event
      await supabase.from("session_events").insert({
        user_id: targetUser.id,
        event_type: "ato_auto_revoke",
        metadata: { risk_score, user_email, trigger: "high_risk_ato" },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `Sessions revoked for ${user_email} (risk: ${risk_score})`,
          action_taken: true,
          error: signOutError?.message || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'force_logout' or 'ato_auto_revoke'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

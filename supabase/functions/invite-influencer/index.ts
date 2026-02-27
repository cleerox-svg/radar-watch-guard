import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify calling user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await userClient.auth.getUser();
    if (claimsError || !claimsData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerUserId = claimsData.user.id;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Only admins can invite influencers" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, display_name, brand_name, subscription_tier } = await req.json();
    if (!email || !display_name) {
      return new Response(JSON.stringify({ error: "Email and display name are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user via invite — sends an email invite link
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        display_name,
        brand_name: brand_name || display_name,
        account_type: "influencer",
      },
    });

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = inviteData.user?.id;

    if (userId) {
      // Assign influencer role
      await adminClient.from("user_roles").insert({
        user_id: userId,
        role: "influencer",
      });

      // The handle_new_influencer trigger should have created the profile,
      // but if not (trigger fires on auth.users insert), create it manually
      const { data: existingProfile } = await adminClient
        .from("influencer_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingProfile) {
        const tier = subscription_tier || "free";
        const maxAccounts = tier === "free" ? 3 : tier === "pro" ? 10 : 50;

        await adminClient.from("influencer_profiles").insert({
          user_id: userId,
          display_name,
          brand_name: brand_name || null,
          subscription_tier: tier,
          max_monitored_accounts: maxAccounts,
        });
      } else if (subscription_tier && subscription_tier !== "free") {
        // Update tier if profile already exists
        const maxAccounts = subscription_tier === "pro" ? 10 : 50;
        await adminClient.from("influencer_profiles").update({
          subscription_tier,
          max_monitored_accounts: maxAccounts,
          brand_name: brand_name || undefined,
        }).eq("id", existingProfile.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("invite-influencer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Invite failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

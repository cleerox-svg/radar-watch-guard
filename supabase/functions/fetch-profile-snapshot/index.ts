/**
 * fetch-profile-snapshot — Fetches current profile data from social platforms
 * using Firecrawl, downloads avatar images, computes changes vs previous snapshot,
 * and stores everything in account_profile_snapshots + updates monitored_accounts.
 *
 * Triggered manually per account or in bulk for an influencer's accounts.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Platform-specific profile URL patterns */
const PLATFORM_PROFILE_URLS: Record<string, (username: string) => string> = {
  twitter: (u) => `https://x.com/${u}`,
  instagram: (u) => `https://instagram.com/${u}`,
  tiktok: (u) => `https://tiktok.com/@${u}`,
  youtube: (u) => `https://youtube.com/@${u}`,
};

interface ProfileData {
  avatar_url: string | null;
  display_name: string | null;
  bio: string | null;
  follower_count: number | null;
  following_count: number | null;
  post_count: number | null;
  verified_on_platform: boolean;
  website_url: string | null;
  location: string | null;
  account_created_at: string | null;
  raw_profile_data: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    const { monitored_account_id, influencer_id } = await req.json();

    // Determine which accounts to fetch
    let accounts: any[] = [];
    if (monitored_account_id) {
      const { data, error } = await supabase
        .from("monitored_accounts")
        .select("*")
        .eq("id", monitored_account_id);
      if (error) throw error;
      accounts = data ?? [];
    } else if (influencer_id) {
      const { data, error } = await supabase
        .from("monitored_accounts")
        .select("*")
        .eq("influencer_id", influencer_id);
      if (error) throw error;
      accounts = data ?? [];
    } else {
      throw new Error("Provide monitored_account_id or influencer_id");
    }

    const results: { account_id: string; success: boolean; changes: string[] }[] = [];

    for (const acct of accounts) {
      try {
        const profileUrl =
          acct.platform_url ||
          PLATFORM_PROFILE_URLS[acct.platform]?.(acct.platform_username) ||
          `https://${acct.platform}.com/${acct.platform_username}`;

        // Scrape the profile page using Firecrawl for structured data
        let profileData: ProfileData = {
          avatar_url: null,
          display_name: null,
          bio: null,
          follower_count: null,
          following_count: null,
          post_count: null,
          verified_on_platform: false,
          website_url: null,
          location: null,
          account_created_at: null,
          raw_profile_data: {},
        };

        if (firecrawlKey) {
          try {
            // Use Firecrawl to scrape profile page with JSON extraction
            const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${firecrawlKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url: profileUrl,
                formats: [
                  "screenshot",
                  {
                    type: "json",
                    schema: {
                      type: "object",
                      properties: {
                        profile_image_url: { type: "string", description: "The URL of the user's profile picture / avatar image" },
                        display_name: { type: "string", description: "The display name shown on the profile" },
                        username: { type: "string", description: "The @username or handle" },
                        bio: { type: "string", description: "The bio / description text" },
                        follower_count: { type: "number", description: "Number of followers" },
                        following_count: { type: "number", description: "Number of accounts following" },
                        post_count: { type: "number", description: "Number of posts/tweets/videos" },
                        is_verified: { type: "boolean", description: "Whether the account has a verified badge" },
                        website: { type: "string", description: "Website URL listed in the profile" },
                        location: { type: "string", description: "Location listed in the profile" },
                        joined_date: { type: "string", description: "When the account was created/joined" },
                      },
                    },
                  },
                ],
                waitFor: 3000,
              }),
            });

            const scrapeData = await scrapeResponse.json();
            const extracted = scrapeData?.data?.json || scrapeData?.json || {};

            profileData = {
              avatar_url: extracted.profile_image_url || null,
              display_name: extracted.display_name || null,
              bio: extracted.bio || null,
              follower_count: extracted.follower_count != null ? Number(extracted.follower_count) : null,
              following_count: extracted.following_count != null ? Number(extracted.following_count) : null,
              post_count: extracted.post_count != null ? Number(extracted.post_count) : null,
              verified_on_platform: !!extracted.is_verified,
              website_url: extracted.website || null,
              location: extracted.location || null,
              account_created_at: extracted.joined_date || null,
              raw_profile_data: {
                ...extracted,
                screenshot: scrapeData?.data?.screenshot ? "[captured]" : null,
                scraped_at: new Date().toISOString(),
                source_url: profileUrl,
              },
            };

            // Download and store avatar image if found
            if (profileData.avatar_url) {
              try {
                const avatarResponse = await fetch(profileData.avatar_url);
                if (avatarResponse.ok) {
                  const avatarBlob = await avatarResponse.blob();
                  const ext = profileData.avatar_url.includes(".png") ? "png" : "jpg";
                  const storagePath = `${acct.influencer_id}/${acct.id}/${Date.now()}.${ext}`;

                  const { error: uploadError } = await supabase.storage
                    .from("profile-avatars")
                    .upload(storagePath, avatarBlob, {
                      contentType: avatarBlob.type || `image/${ext}`,
                      upsert: true,
                    });

                  if (!uploadError) {
                    const { data: publicUrl } = supabase.storage
                      .from("profile-avatars")
                      .getPublicUrl(storagePath);

                    profileData.raw_profile_data.avatar_storage_path = storagePath;
                    profileData.raw_profile_data.avatar_local_url = publicUrl.publicUrl;
                  }
                }
              } catch (avatarErr: unknown) {
                const msg = avatarErr instanceof Error ? avatarErr.message : "Avatar download failed";
                console.error("Avatar download error:", msg);
              }
            }

            // Use AI to compute a simple perceptual description for avatar comparison
            // This helps detect impersonators using similar profile pictures
          } catch (scrapeErr: unknown) {
            const msg = scrapeErr instanceof Error ? scrapeErr.message : "Scrape failed";
            console.error(`Firecrawl scrape error for ${profileUrl}:`, msg);
          }
        }

        // Fetch previous snapshot for change detection
        const { data: prevSnapshots } = await supabase
          .from("account_profile_snapshots")
          .select("*")
          .eq("monitored_account_id", acct.id)
          .order("captured_at", { ascending: false })
          .limit(1);

        const prev = prevSnapshots?.[0];
        const changes: string[] = [];

        if (prev) {
          if (profileData.avatar_url && profileData.avatar_url !== prev.avatar_url) changes.push("avatar_url");
          if (profileData.display_name && profileData.display_name !== prev.display_name) changes.push("display_name");
          if (profileData.bio && profileData.bio !== prev.bio) changes.push("bio");
          if (profileData.follower_count != null && profileData.follower_count !== prev.follower_count) changes.push("follower_count");
          if (profileData.following_count != null && profileData.following_count !== prev.following_count) changes.push("following_count");
          if (profileData.post_count != null && profileData.post_count !== prev.post_count) changes.push("post_count");
          if (profileData.verified_on_platform !== prev.verified_on_platform) changes.push("verified_on_platform");
          if (profileData.website_url && profileData.website_url !== prev.website_url) changes.push("website_url");
          if (profileData.location && profileData.location !== prev.location) changes.push("location");
        }

        // Insert new snapshot
        const storagePath = profileData.raw_profile_data?.avatar_storage_path as string | undefined;
        const { error: snapError } = await supabase
          .from("account_profile_snapshots")
          .insert({
            monitored_account_id: acct.id,
            influencer_id: acct.influencer_id,
            avatar_url: profileData.avatar_url,
            avatar_storage_path: storagePath || null,
            display_name: profileData.display_name,
            bio: profileData.bio,
            follower_count: profileData.follower_count,
            following_count: profileData.following_count,
            post_count: profileData.post_count,
            verified_on_platform: profileData.verified_on_platform,
            website_url: profileData.website_url,
            location: profileData.location,
            account_created_at: profileData.account_created_at,
            raw_profile_data: profileData.raw_profile_data,
            changes_detected: changes,
            has_changes: changes.length > 0,
          });

        if (snapError) {
          console.error("Snapshot insert error:", snapError.message);
        }

        // Update monitored_accounts with current profile info
        const prevChanges = acct.profile_changes_count ?? 0;
        const { error: updateErr } = await supabase
          .from("monitored_accounts")
          .update({
            current_avatar_url: profileData.avatar_url || acct.current_avatar_url,
            current_display_name: profileData.display_name || acct.current_display_name,
            current_bio: profileData.bio || acct.current_bio,
            current_follower_count: profileData.follower_count,
            current_following_count: profileData.following_count,
            current_post_count: profileData.post_count,
            current_verified: profileData.verified_on_platform,
            profile_changes_count: prevChanges + (changes.length > 0 ? 1 : 0),
            last_profile_fetch_at: new Date().toISOString(),
          })
          .eq("id", acct.id);

        if (updateErr) console.error("Account update error:", updateErr.message);

        results.push({ account_id: acct.id, success: true, changes });
      } catch (acctErr: unknown) {
        const msg = acctErr instanceof Error ? acctErr.message : "Unknown error";
        console.error(`Error processing account ${acct.id}:`, msg);
        results.push({ account_id: acct.id, success: false, changes: [] });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
        summary: `Fetched profiles for ${results.filter((r) => r.success).length}/${results.length} accounts`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("fetch-profile-snapshot error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

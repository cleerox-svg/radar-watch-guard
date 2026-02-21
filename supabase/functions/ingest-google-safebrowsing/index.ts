/**
 * ingest-google-safebrowsing — Google Safe Browsing API v4
 * Free tier: 10,000 lookups/day. Checks queued domains against Google's
 * phishing/malware/social-engineering threat lists.
 * Requires: GOOGLE_SAFEBROWSING_API_KEY secret.
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
    const apiKey = Deno.env.get("GOOGLE_SAFEBROWSING_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "GOOGLE_SAFEBROWSING_API_KEY not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get recent active threats to check against Safe Browsing
    const { data: threats } = await sb
      .from("threats")
      .select("domain, source")
      .eq("status", "active")
      .order("last_seen", { ascending: false })
      .limit(500);

    if (!threats || threats.length === 0) {
      await sb.from("feed_schedules").update({
        last_run_at: new Date().toISOString(),
        last_status: "success",
        last_records: 0,
      }).eq("feed_source", "google_safebrowsing");

      return new Response(
        JSON.stringify({ success: true, checked: 0, flagged: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domains = [...new Set(threats.map(t => t.domain))];

    // Process in batches of 500 (API limit per request)
    let totalFlagged = 0;
    const flaggedDomains: string[] = [];

    for (let i = 0; i < domains.length; i += 500) {
      const batch = domains.slice(i, i + 500);
      const threatEntries = batch.map(d => ({ url: `https://${d}/` }));

      const res = await fetch(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client: { clientId: "lrx-radar", clientVersion: "1.0" },
            threatInfo: {
              threatTypes: [
                "MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE",
                "POTENTIALLY_HARMFUL_APPLICATION",
              ],
              platformTypes: ["ANY_PLATFORM"],
              threatEntryTypes: ["URL"],
              threatEntries,
            },
          }),
        }
      );

      if (!res.ok) {
        console.error("Safe Browsing API error:", res.status, await res.text());
        continue;
      }

      const data = await res.json();
      if (data.matches) {
        for (const match of data.matches) {
          try {
            const url = new URL(match.threat.url);
            flaggedDomains.push(url.hostname);
          } catch { /* skip */ }
        }
        totalFlagged += data.matches.length;
      }
    }

    // Update flagged threats with Google's confirmation
    if (flaggedDomains.length > 0) {
      const records = flaggedDomains.map(domain => ({
        domain,
        brand: "Google Safe Browsing Flag",
        attack_type: "phishing",
        severity: "high" as const,
        source: "google_safebrowsing" as const,
        status: "active" as const,
        confidence: 95,
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        metadata: { verified_by: "google_safe_browsing_v4" },
      }));

      for (let i = 0; i < records.length; i += 200) {
        const chunk = records.slice(i, i + 200);
        const { error } = await sb.from("threats").upsert(chunk, {
          onConflict: "domain,source",
          ignoreDuplicates: true,
        });
        if (error) console.error("GSB upsert error:", error.message);
      }
    }

    await sb.from("feed_schedules").update({
      last_run_at: new Date().toISOString(),
      last_status: "success",
      last_records: totalFlagged,
    }).eq("feed_source", "google_safebrowsing");

    console.log(`Google Safe Browsing: checked ${domains.length}, flagged ${totalFlagged}`);

    return new Response(
      JSON.stringify({ success: true, checked: domains.length, flagged: totalFlagged }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Google Safe Browsing error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

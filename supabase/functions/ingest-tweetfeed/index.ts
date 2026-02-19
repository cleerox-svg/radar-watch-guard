/**
 * ingest-tweetfeed — Pulls IOCs from TweetFeed.live (free, no API key).
 *
 * TweetFeed collects IOCs (URLs, domains, IPs, hashes) shared by the
 * infosec community on X/Twitter. Data is upserted into social_iocs.
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const timeRange = body.timeRange || "week"; // today, week, month, year
    const iocFilter = body.iocFilter || "";     // ip, url, domain, sha256, md5 or empty for all

    // Build TweetFeed API URL
    let apiUrl = `https://api.tweetfeed.live/v1/${timeRange}`;
    if (iocFilter) {
      apiUrl += `/${iocFilter}`;
    }

    console.log("Fetching TweetFeed:", apiUrl);
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`TweetFeed API error ${res.status}: ${errText}`);
    }

    const iocs: Array<{
      date: string;
      user: string;
      type: string;
      value: string;
      tags: string[];
      tweet: string;
    }> = await res.json();

    console.log(`TweetFeed returned ${iocs.length} IOCs`);

    // Map to our schema
    const records = iocs.map((ioc) => ({
      ioc_type: ioc.type,
      ioc_value: ioc.value,
      tags: (ioc.tags || []).map((t: string) => t.replace(/^#/, "").toLowerCase()),
      source: "tweetfeed",
      source_user: ioc.user || null,
      source_url: ioc.tweet || null,
      date_shared: ioc.date || new Date().toISOString(),
      confidence: inferConfidence(ioc.tags || []),
    }));

    // Batch upsert (max 500 at a time)
    let upserted = 0;
    for (let i = 0; i < records.length; i += 500) {
      const batch = records.slice(i, i + 500);
      const { error } = await sb
        .from("social_iocs")
        .upsert(batch, { onConflict: "source,ioc_value", ignoreDuplicates: true });
      if (error) {
        console.error("Upsert batch error:", error);
      } else {
        upserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        fetched: iocs.length,
        upserted,
        timeRange,
        iocFilter: iocFilter || "all",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("TweetFeed ingestion error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Infer confidence based on tags — APT/ransomware tags = high confidence */
function inferConfidence(tags: string[]): string {
  const tagStr = tags.join(" ").toLowerCase();
  if (/apt|ransomware|zero.?day|exploit|cve-/i.test(tagStr)) return "high";
  if (/cobalt.?strike|emotet|qakbot|icedid|loader|stealer/i.test(tagStr)) return "high";
  if (/phishing|malware|c2|command/i.test(tagStr)) return "medium";
  return "low";
}

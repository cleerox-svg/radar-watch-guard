/**
 * ingest-certstream — Polls CertStream for recently issued SSL certificates.
 * Uses the Certstream API to detect potential typosquatting and phishing domains
 * based on certificate transparency logs.
 *
 * Note: CertStream's WebSocket provides real-time data, but since edge functions
 * are request-based, we use the REST-compatible crt.sh API as an alternative
 * to monitor certificates for brand keywords.
 *
 * Data upserted into threats table with source='certstream'.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Brand keywords to monitor in certificate transparency logs */
const BRAND_KEYWORDS = ["paypal", "microsoft", "apple", "google", "amazon", "netflix", "chase", "wells fargo", "bank of america", "coinbase"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const keywords = body.keywords || BRAND_KEYWORDS.slice(0, 3); // Limit to 3 per run
    let allRecords: any[] = [];

    for (const keyword of keywords) {
      try {
        // crt.sh provides certificate transparency search
        const res = await fetch(
          `https://crt.sh/?q=%25${encodeURIComponent(keyword)}%25&output=json&exclude=expired`,
          { headers: { "User-Agent": "LRX-Radar/1.0" } }
        );
        if (!res.ok) { console.error(`crt.sh ${keyword} fetch error ${res.status}`); continue; }

        const certs = await res.json();
        // Only recent certs (last 24h)
        const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
        const recent = certs.filter((c: any) => c.entry_timestamp > oneDayAgo).slice(0, 50);
        console.log(`CertStream/${keyword}: ${recent.length} recent certs (of ${certs.length} total)`);

        const records = recent.map((cert: any) => {
          const domain = cert.common_name || cert.name_value?.split("\n")[0] || "unknown";
          // Skip if it's an exact brand domain (not a typosquat)
          if (domain === `${keyword}.com` || domain === `www.${keyword}.com`) return null;
          return {
            domain,
            brand: keyword,
            attack_type: "typosquat_cert",
            severity: "medium" as const,
            source: "certstream" as const,
            status: "active" as const,
            confidence: 60,
            first_seen: cert.entry_timestamp || new Date().toISOString(),
            last_seen: cert.entry_timestamp || new Date().toISOString(),
            metadata: {
              issuer: cert.issuer_name,
              serial: cert.serial_number,
              not_before: cert.not_before,
              not_after: cert.not_after,
            },
          };
        }).filter(Boolean);
        allRecords.push(...records);
      } catch (e) {
        console.error(`CertStream ${keyword} error:`, e instanceof Error ? e.message : e);
      }
    }

    console.log(`CertStream total: ${allRecords.length} suspicious certs`);

    let upserted = 0;
    for (let i = 0; i < allRecords.length; i += 200) {
      const chunk = allRecords.slice(i, i + 200);
      const { error } = await sb.from("threats").upsert(chunk, { onConflict: "domain,source", ignoreDuplicates: true });
      if (error) console.error("CertStream upsert error:", error.message);
      else upserted += chunk.length;
    }

    await sb.from("feed_schedules").update({ last_run_at: new Date().toISOString(), last_status: "success", last_records: upserted }).eq("feed_source", "certstream");

    return new Response(
      JSON.stringify({ success: true, fetched: allRecords.length, upserted, keywords_scanned: keywords }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("CertStream ingestion error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

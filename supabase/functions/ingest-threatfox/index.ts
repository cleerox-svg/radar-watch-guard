/**
 * ingest-threatfox — Pulls IOCs from Abuse.ch ThreatFox (free, no API key).
 * ThreatFox tracks C2 servers, botnets, stealer configs, and other IOCs.
 * Data is upserted into social_iocs table.
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
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const days = body.days || 1;

    // ThreatFox — try CSV export first (no auth required), fall back to API
    let iocs: any[] = [];
    
    // Try the free CSV export endpoint
    const csvRes = await fetch("https://threatfox.abuse.ch/export/json/recent/", {
      headers: { "User-Agent": "LRX-Radar/1.0" },
    });

    if (csvRes.ok) {
      const csvData = await csvRes.json().catch(() => null);
      if (csvData && typeof csvData === "object") {
        // The JSON export has numeric keys with IOC objects
        iocs = Object.values(csvData).flat().slice(0, 500) as any[];
      }
    }
    
    // Fallback: try API with optional auth key
    if (iocs.length === 0) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const authKey = Deno.env.get("THREATFOX_AUTH_KEY");
      if (authKey) headers["Auth-Key"] = authKey;
      
      const res = await fetch("https://threatfox-api.abuse.ch/api/v1/", {
        method: "POST",
        headers,
        body: JSON.stringify({ query: "get_iocs", days }),
      });

      if (res.ok) {
        const json = await res.json();
        iocs = json.data || [];
      }
    }

    console.log(`ThreatFox returned ${iocs.length} IOCs`);

    const records = iocs.slice(0, 500).map((ioc: any) => {
      const rawTags = ioc.tags;
      const tags = Array.isArray(rawTags) ? rawTags.map((t: string) => t.toLowerCase()) :
        typeof rawTags === "string" ? rawTags.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean) : [];
      return {
      ioc_type: ioc.ioc_type || ioc.type || "unknown",
      ioc_value: ioc.ioc || ioc.ioc_value || ioc.value || "unknown",
      tags,
      source: "threatfox",
      source_user: ioc.reporter || null,
      source_url: ioc.reference || null,
      date_shared: ioc.first_seen_utc || new Date().toISOString(),
      confidence: ioc.confidence_level ? (ioc.confidence_level >= 75 ? "high" : ioc.confidence_level >= 50 ? "medium" : "low") : "medium",
    };
    });

    let upserted = 0;
    for (let i = 0; i < records.length; i += 500) {
      const batch = records.slice(i, i + 500);
      const { error } = await sb
        .from("social_iocs")
        .upsert(batch, { onConflict: "source,ioc_value", ignoreDuplicates: true });
      if (error) console.error("Upsert error:", error);
      else upserted += batch.length;
    }

    return new Response(
      JSON.stringify({ success: true, fetched: iocs.length, upserted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("ThreatFox ingestion error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

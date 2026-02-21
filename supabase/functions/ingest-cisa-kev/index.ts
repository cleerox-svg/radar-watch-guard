/**
 * ingest-cisa-kev — Supabase Edge Function
 *
 * Pulls the CISA Known Exploited Vulnerabilities (KEV) catalog and upserts
 * the most recent entries into the `threat_news` table.
 *
 * Data source: https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
 *   - Public JSON feed, no API key required
 *   - Contains CVE IDs, vendor/product, description, and due dates
 *   - Updated regularly as new actively-exploited vulns are confirmed
 *
 * Flow:
 *   1. Fetch the full KEV catalog JSON from CISA
 *   2. Sort by dateAdded descending to get the most recent entries
 *   3. Take the top 20 and normalize into threat_news schema
 *   4. Upsert using the unique (source, title) constraint to deduplicate
 *
 * Security: Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS for writes.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** CISA KEV record shape from the public JSON feed */
interface KevEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  shortDescription: string;
  dateAdded: string;           // ISO date string (YYYY-MM-DD)
  dueDate: string;             // Remediation due date
  knownRansomwareCampaignUse: string; // "Known" | "Unknown"
  notes: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Fetch the full CISA KEV catalog (public JSON, ~1500 entries)
    const res = await fetch(
      'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
      { headers: { 'Accept': 'application/json' } }
    );

    if (!res.ok) {
      throw new Error(`CISA KEV fetch failed: ${res.status} ${res.statusText}`);
    }

    const catalog = await res.json();
    const vulnerabilities: KevEntry[] = catalog.vulnerabilities || [];

    // Step 2: Sort by dateAdded descending → most recently added first
    vulnerabilities.sort((a, b) =>
      new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
    );

    // Step 3: Take top 20 and normalize into threat_news schema
    const records = vulnerabilities.slice(0, 20).map((vuln) => {
      // Determine severity based on ransomware usage and due date urgency
      const isRansomware = vuln.knownRansomwareCampaignUse === 'Known';
      const dueDate = new Date(vuln.dueDate);
      const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      let severity = 'high';
      if (isRansomware || daysUntilDue <= 7) severity = 'critical';
      else if (daysUntilDue <= 30) severity = 'high';

      return {
        title: `${vuln.cveID}: ${vuln.vulnerabilityName}`,
        description: vuln.shortDescription,
        source: 'cisa_kev',
        severity,
        url: `https://nvd.nist.gov/vuln/detail/${vuln.cveID}`,
        cve_id: vuln.cveID,
        vendor: vuln.vendorProject,
        product: vuln.product,
        date_published: new Date(vuln.dateAdded).toISOString(),
        metadata: {
          due_date: vuln.dueDate,
          ransomware_use: vuln.knownRansomwareCampaignUse,
          notes: vuln.notes,
          days_until_due: daysUntilDue,
        },
      };
    });

    // Step 4: Upsert into threat_news — deduplicates on (source, title)
    let newCount = 0;
    if (records.length > 0) {
      const { error } = await supabase.from('threat_news').upsert(
        records,
        { onConflict: 'source,title', ignoreDuplicates: true }
      );
      if (error) {
        console.error('CISA KEV upsert error:', error);
        throw error;
      }
      newCount = records.length;
    }

    return new Response(
      JSON.stringify({ success: true, fetched: vulnerabilities.length, upserted: newCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('CISA KEV ingestion error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

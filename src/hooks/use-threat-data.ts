/**
 * use-threat-data.ts — React Query hooks for all threat intelligence data.
 *
 * Each hook queries a specific table in the Lovable Cloud database:
 *   - threats:           Ingested IOCs (domains, IPs, brands) from external feeds
 *   - ato_events:        Account-takeover detections (impossible travel, credential stuffing)
 *   - email_auth_reports: DMARC/SPF/DKIM aggregate reports per sending source
 *   - feed_ingestions:   Audit log of each feed pull (source, status, record counts)
 *   - attack_metrics:    Time-series counters for dashboard KPIs
 *
 * All hooks auto-refresh on an interval so the UI stays near-real-time without
 * requiring WebSocket subscriptions (Realtime is used separately in Index.tsx
 * for toast notifications on new threat inserts).
 */

import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

/**
 * Fetches the 200 most recent threats ordered by last_seen descending.
 * Refreshes every 30 seconds. Used by ThreatHeatmap, ThreatMapWidget,
 * and ThreatStatistics to power live target tables, heatmap markers,
 * attack vector bars, severity charts, and source breakdowns.
 *
 * DB table: public.threats
 *   - Unique constraint on `domain` enables upsert deduplication during ingestion.
 *   - RLS: public SELECT (read-only); INSERT/UPDATE restricted to service role (edge functions).
 */
export function useThreats() {
  return useQuery({
    queryKey: ["threats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threats")
        .select("*")
        .order("last_seen", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}

/**
 * Fetches the 20 most recent account-takeover events ordered by detected_at.
 * Refreshes every 15 seconds. Used by AccountTakeover component for the
 * ATO timeline chart, impossible-travel event list, and summary stats.
 *
 * DB table: public.ato_events
 *   - Tracks impossible travel, credential-stuffing, and session-hijack events.
 *   - Each row records source/destination IPs, geolocations, risk score, and resolution status.
 *   - RLS: public SELECT; INSERT restricted to service role.
 */
export function useAtoEvents() {
  return useQuery({
    queryKey: ["ato_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ato_events")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });
}

/**
 * Fetches the 20 most recent email authentication (DMARC) reports.
 * Refreshes every 60 seconds. Used by EmailAuth for the authentication funnel
 * (SPF → DKIM → DMARC pass rates), policy enforcement status, and shadow-IT
 * source detection. Also used in ThreatHeatmap for the email auth stats widget.
 *
 * DB table: public.email_auth_reports
 *   - Each row = one sending source's aggregate for a report_date.
 *   - Columns: source_name, volume, spf_pass, dkim_pass, dmarc_aligned, policy.
 *   - RLS: public SELECT; INSERT restricted to service role.
 */
export function useEmailAuthReports() {
  return useQuery({
    queryKey: ["email_auth_reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_auth_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });
}

/**
 * Fetches the 10 most recent feed ingestion audit records.
 * No auto-refresh — pulled on-demand. Used to show ingestion history
 * (which feeds were pulled, how many records were fetched/new, status).
 *
 * DB table: public.feed_ingestions
 *   - Created by the ingest-threats edge function at the start of each pull.
 *   - Updated with records_fetched, records_new, completed_at on completion.
 *   - RLS: public SELECT; INSERT/UPDATE restricted to service role.
 */
export function useFeedIngestions() {
  return useQuery({
    queryKey: ["feed_ingestions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_ingestions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Fetches the 50 most recent attack metric data points.
 * Refreshes every 30 seconds. Used by ThreatStatistics for time-series KPIs.
 *
 * DB table: public.attack_metrics
 *   - Generic counter table: metric_name, metric_value, category, country, recorded_at.
 *   - RLS: public SELECT; INSERT restricted to service role.
 */
export function useAttackMetrics() {
  return useQuery({
    queryKey: ["attack_metrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attack_metrics")
        .select("*")
        .order("recorded_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}

/**
 * Invokes the `ingest-threats` edge function to pull fresh data from an
 * external threat intelligence feed and upsert it into the threats table.
 *
 * @param source - Feed identifier: "urlhaus" | "openphish" | "phishtank"
 * @returns { fetched: number, new: number } — counts from the ingestion run.
 *
 * Edge function: supabase/functions/ingest-threats/index.ts
 *   - Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS for inserts.
 *   - Upserts on `domain` unique constraint to avoid duplicates.
 *   - Logs each run in feed_ingestions for audit trail.
 */
export async function triggerIngestion(source: string = "urlhaus") {
  const { data, error } = await supabase.functions.invoke("ingest-threats", {
    body: { source },
  });
  if (error) throw error;
  return data;
}

/**
 * Fetches the 20 most recent urgent threat news items (CISA KEV entries).
 * Refreshes every 60 seconds. Used by UrgentThreatsNews widget.
 *
 * DB table: public.threat_news
 *   - Populated by the ingest-cisa-kev edge function.
 *   - Each row = one CVE from the CISA Known Exploited Vulnerabilities catalog.
 *   - RLS: public SELECT; INSERT restricted to service role.
 */
export function useThreatNews() {
  return useQuery({
    queryKey: ["threat_news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threat_news")
        .select("*")
        .order("date_published", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,
  });
}

/**
 * Invokes the `ingest-cisa-kev` edge function to pull the latest
 * CISA Known Exploited Vulnerabilities and upsert into threat_news.
 *
 * @returns { fetched: number, upserted: number }
 */
export async function triggerCisaKevIngestion() {
  const { data, error } = await supabase.functions.invoke("ingest-cisa-kev");
  if (error) throw error;
  return data;
}

export async function triggerOtxIngestion() {
  const { data, error } = await supabase.functions.invoke("ingest-otx-pulses");
  if (error) throw error;
  return data;
}

// ─── New Feed Triggers ───

export async function triggerThreatFoxIngestion(days: number = 1) {
  const { data, error } = await supabase.functions.invoke("ingest-threatfox", {
    body: { days },
  });
  if (error) throw error;
  return data;
}

export async function triggerSansIscIngestion() {
  const { data, error } = await supabase.functions.invoke("ingest-sans-isc");
  if (error) throw error;
  return data;
}

export async function triggerRansomwatchIngestion() {
  const { data, error } = await supabase.functions.invoke("ingest-ransomwatch");
  if (error) throw error;
  return data;
}

export async function triggerTorExitIngestion() {
  const { data, error } = await supabase.functions.invoke("ingest-tor-exits");
  if (error) throw error;
  return data;
}

export async function triggerMastodonIngestion(hashtag: string = "threatintel") {
  const { data, error } = await supabase.functions.invoke("ingest-mastodon", {
    body: { hashtag },
  });
  if (error) throw error;
  return data;
}

export async function checkPwnedPassword(password: string) {
  const { data, error } = await supabase.functions.invoke("check-pwned-password", {
    body: { password },
  });
  if (error) throw error;
  return data;
}

// ─── New Feed Triggers (v2) ───

export async function triggerFeodoIngestion() {
  const { data, error } = await supabase.functions.invoke("ingest-feodo");
  if (error) throw error;
  return data;
}

export async function triggerMalBazaarIngestion() {
  const { data, error } = await supabase.functions.invoke("ingest-malbazaar");
  if (error) throw error;
  return data;
}

export async function triggerBlocklistDeIngestion() {
  const { data, error } = await supabase.functions.invoke("ingest-blocklist-de");
  if (error) throw error;
  return data;
}

export async function triggerSslBlocklistIngestion() {
  const { data, error } = await supabase.functions.invoke("ingest-ssl-blocklist");
  if (error) throw error;
  return data;
}

export async function triggerSpamhausDropIngestion() {
  const { data, error } = await supabase.functions.invoke("ingest-spamhaus-drop");
  if (error) throw error;
  return data;
}

export async function triggerCertstreamIngestion(keywords?: string[]) {
  const { data, error } = await supabase.functions.invoke("ingest-certstream", {
    body: keywords ? { keywords } : {},
  });
  if (error) throw error;
  return data;
}

export function useTorExitNodes() {
  return useQuery({
    queryKey: ["tor_exit_nodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tor_exit_nodes")
        .select("*")
        .order("last_seen", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 120000,
  });
}

/** Hook to query feed schedule metadata for admin UI */
export function useFeedSchedules() {
  return useQuery({
    queryKey: ["feed_schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feed_schedules")
        .select("*")
        .order("feed_source");
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
}


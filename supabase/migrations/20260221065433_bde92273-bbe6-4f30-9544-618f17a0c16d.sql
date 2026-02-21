
-- =============================================================
-- DATABASE OPTIMIZATION MIGRATION
-- =============================================================

-- 1. Fix threats: change UNIQUE(domain) → UNIQUE(domain, source)
--    This allows the same domain to appear from multiple feed sources
ALTER TABLE public.threats DROP CONSTRAINT IF EXISTS threats_domain_key;
ALTER TABLE public.threats ADD CONSTRAINT threats_domain_source_key UNIQUE (domain, source);

-- 2. Add missing composite unique index on threat_news(source, title)
--    Required for upsert deduplication in CISA KEV, OTX, Ransomwatch feeds
CREATE UNIQUE INDEX IF NOT EXISTS threat_news_source_title_key
  ON public.threat_news (source, title);

-- 3. Add performance indexes on feed_ingestions
CREATE INDEX IF NOT EXISTS idx_feed_ingestions_source ON public.feed_ingestions (source);
CREATE INDEX IF NOT EXISTS idx_feed_ingestions_started ON public.feed_ingestions (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_ingestions_status ON public.feed_ingestions (status);

-- 4. Add performance indexes on threats for dashboard queries
CREATE INDEX IF NOT EXISTS idx_threats_source ON public.threats (source);
CREATE INDEX IF NOT EXISTS idx_threats_severity ON public.threats (severity);
CREATE INDEX IF NOT EXISTS idx_threats_last_seen ON public.threats (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_threats_status ON public.threats (status);
CREATE INDEX IF NOT EXISTS idx_threats_country ON public.threats (country);

-- 5. Add performance indexes on threat_news for dashboard queries
CREATE INDEX IF NOT EXISTS idx_threat_news_date ON public.threat_news (date_published DESC);
CREATE INDEX IF NOT EXISTS idx_threat_news_severity ON public.threat_news (severity);
CREATE INDEX IF NOT EXISTS idx_threat_news_source ON public.threat_news (source);
CREATE INDEX IF NOT EXISTS idx_threat_news_cve ON public.threat_news (cve_id) WHERE cve_id IS NOT NULL;

-- 6. Add index on tor_exit_nodes for faster lookups
CREATE INDEX IF NOT EXISTS idx_tor_exit_last_seen ON public.tor_exit_nodes (last_seen DESC);

-- 7. Add index on ato_events for dashboard filtering
CREATE INDEX IF NOT EXISTS idx_ato_events_detected ON public.ato_events (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_ato_events_resolved ON public.ato_events (resolved);

-- 8. Drop unused scan_leads table
DROP TABLE IF EXISTS public.scan_leads;

-- 9. Create ingestion_jobs queue table for worker coordination
CREATE TABLE public.ingestion_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_source text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 5,
  batch_size integer NOT NULL DEFAULT 500,
  records_processed integer DEFAULT 0,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes for job queue processing
CREATE INDEX idx_jobs_status_priority ON public.ingestion_jobs (status, priority DESC);
CREATE INDEX idx_jobs_feed_source ON public.ingestion_jobs (feed_source);
CREATE INDEX idx_jobs_created ON public.ingestion_jobs (created_at DESC);

-- RLS for ingestion_jobs (service role only for writes, authenticated read)
ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view jobs"
  ON public.ingestion_jobs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can insert jobs"
  ON public.ingestion_jobs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update jobs"
  ON public.ingestion_jobs FOR UPDATE
  USING (true);

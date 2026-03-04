
-- Table for cloud provider incidents, outages, and CSP-targeted attacks
CREATE TABLE public.cloud_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,                    -- aws, azure, gcp, cloudflare, etc.
  service TEXT,                              -- S3, EC2, Azure AD, etc.
  incident_type TEXT NOT NULL DEFAULT 'outage', -- outage, degradation, attack, bgp_hijack, bgp_leak
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',   -- critical, high, medium, low, info
  status TEXT NOT NULL DEFAULT 'active',     -- active, resolved, monitoring
  source TEXT NOT NULL DEFAULT 'status_page', -- status_page, cloudflare_radar, bgpstream, manual
  source_url TEXT,
  region TEXT,                               -- us-east-1, europe-west1, global, etc.
  asn TEXT,                                  -- for BGP events
  affected_prefixes TEXT[],                  -- for BGP events
  attack_type TEXT,                          -- ddos, bgp_hijack, route_leak, null for outages
  impact_score INTEGER DEFAULT 50,           -- 0-100 estimated impact
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cloud_incidents ENABLE ROW LEVEL SECURITY;

-- Public read, service role write
CREATE POLICY "Public read for cloud_incidents"
  ON public.cloud_incidents FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert cloud_incidents"
  ON public.cloud_incidents FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update cloud_incidents"
  ON public.cloud_incidents FOR UPDATE
  USING (true);

-- Unique constraint for dedup
CREATE UNIQUE INDEX idx_cloud_incidents_dedup 
  ON public.cloud_incidents (provider, title, started_at);

-- Index for time-based queries
CREATE INDEX idx_cloud_incidents_started ON public.cloud_incidents (started_at DESC);
CREATE INDEX idx_cloud_incidents_provider ON public.cloud_incidents (provider, status);

-- Add to feed_source_type enum
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'cloud_status';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'cloudflare_radar';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'bgpstream';

-- Timestamp trigger
CREATE TRIGGER update_cloud_incidents_updated_at
  BEFORE UPDATE ON public.cloud_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.cloud_incidents;

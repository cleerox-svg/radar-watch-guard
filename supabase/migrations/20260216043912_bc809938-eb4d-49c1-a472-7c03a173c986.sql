
-- Social IOCs table for TweetFeed and similar social media threat feeds
CREATE TABLE public.social_iocs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ioc_type TEXT NOT NULL,          -- ip, url, domain, sha256, md5
  ioc_value TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'tweetfeed',
  source_user TEXT,                -- Twitter user who shared
  source_url TEXT,                 -- Link to original tweet
  date_shared TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source, ioc_value)
);

ALTER TABLE public.social_iocs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for social_iocs"
  ON public.social_iocs FOR SELECT USING (true);

CREATE POLICY "Service role insert for social_iocs"
  ON public.social_iocs FOR INSERT
  WITH CHECK (false);  -- Only service role can insert

CREATE POLICY "Service role update for social_iocs"
  ON public.social_iocs FOR UPDATE
  USING (false);

CREATE INDEX idx_social_iocs_type ON public.social_iocs(ioc_type);
CREATE INDEX idx_social_iocs_date ON public.social_iocs(date_shared DESC);
CREATE INDEX idx_social_iocs_tags ON public.social_iocs USING GIN(tags);

-- Enable realtime for social_iocs
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_iocs;

-- Breach checks table for dark web monitoring results
CREATE TABLE public.breach_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  check_type TEXT NOT NULL,        -- email, domain, password
  check_value TEXT NOT NULL,       -- The email/domain checked (hashed for passwords)
  breaches_found INTEGER DEFAULT 0,
  breach_names TEXT[] DEFAULT '{}',
  pastes_found INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'low',   -- low, medium, high, critical
  last_checked TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(check_type, check_value)
);

ALTER TABLE public.breach_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for breach_checks"
  ON public.breach_checks FOR SELECT USING (true);

CREATE POLICY "Service role insert for breach_checks"
  ON public.breach_checks FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Service role update for breach_checks"
  ON public.breach_checks FOR UPDATE
  USING (false);

CREATE INDEX idx_breach_checks_type ON public.breach_checks(check_type);
CREATE INDEX idx_breach_checks_risk ON public.breach_checks(risk_level);

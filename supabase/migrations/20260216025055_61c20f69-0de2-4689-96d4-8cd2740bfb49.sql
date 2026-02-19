
-- Threat intelligence data tables for LRX Radar

-- Enum for threat severity
CREATE TYPE public.threat_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');

-- Enum for threat status
CREATE TYPE public.threat_status AS ENUM ('active', 'investigating', 'mitigated', 'resolved');

-- Enum for data source type
CREATE TYPE public.feed_source_type AS ENUM ('phishtank', 'urlhaus', 'abuseipdb', 'openphish', 'manual', 'other');

-- Main threats table
CREATE TABLE public.threats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  domain TEXT NOT NULL,
  attack_type TEXT NOT NULL,
  confidence INTEGER NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  severity threat_severity NOT NULL DEFAULT 'medium',
  status threat_status NOT NULL DEFAULT 'active',
  source feed_source_type NOT NULL DEFAULT 'manual',
  country TEXT,
  ip_address TEXT,
  first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ATO (Account Takeover) events
CREATE TABLE public.ato_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'impossible_travel',
  location_from TEXT,
  location_to TEXT,
  ip_from TEXT,
  ip_to TEXT,
  risk_score INTEGER DEFAULT 0,
  resolved BOOLEAN DEFAULT false,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Email authentication (DMARC/SPF/DKIM) reports
CREATE TABLE public.email_auth_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name TEXT NOT NULL,
  volume INTEGER NOT NULL DEFAULT 0,
  spf_pass BOOLEAN DEFAULT false,
  dkim_pass BOOLEAN DEFAULT false,
  dmarc_aligned BOOLEAN DEFAULT false,
  policy TEXT DEFAULT 'none',
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ingestion pipeline tracking
CREATE TABLE public.feed_ingestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source feed_source_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  records_fetched INTEGER DEFAULT 0,
  records_new INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Attack metrics (aggregated stats for dashboard)
CREATE TABLE public.attack_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL DEFAULT 0,
  category TEXT,
  country TEXT,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.threats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ato_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_auth_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_ingestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attack_metrics ENABLE ROW LEVEL SECURITY;

-- Public read access (this is a monitoring dashboard, data is not user-specific)
CREATE POLICY "Allow public read on threats" ON public.threats FOR SELECT USING (true);
CREATE POLICY "Allow public read on ato_events" ON public.ato_events FOR SELECT USING (true);
CREATE POLICY "Allow public read on email_auth_reports" ON public.email_auth_reports FOR SELECT USING (true);
CREATE POLICY "Allow public read on feed_ingestions" ON public.feed_ingestions FOR SELECT USING (true);
CREATE POLICY "Allow public read on attack_metrics" ON public.attack_metrics FOR SELECT USING (true);

-- Service role insert (edge functions will insert via service role)
CREATE POLICY "Service role can insert threats" ON public.threats FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can insert ato_events" ON public.ato_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can insert email_auth_reports" ON public.email_auth_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can insert feed_ingestions" ON public.feed_ingestions FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can insert attack_metrics" ON public.attack_metrics FOR INSERT WITH CHECK (true);

-- Service role update
CREATE POLICY "Service role can update threats" ON public.threats FOR UPDATE USING (true);
CREATE POLICY "Service role can update feed_ingestions" ON public.feed_ingestions FOR UPDATE USING (true);

-- Enable realtime for threats table
ALTER PUBLICATION supabase_realtime ADD TABLE public.threats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ato_events;

-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_threats_updated_at
  BEFORE UPDATE ON public.threats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

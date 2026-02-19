
-- Table to store urgent threat news items from CISA KEV, OTX pulses, and Abusix
CREATE TABLE public.threat_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'cisa_kev',
  severity TEXT NOT NULL DEFAULT 'high',
  url TEXT,
  cve_id TEXT,
  vendor TEXT,
  product TEXT,
  date_published TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint to avoid duplicate entries (by source + title combo)
CREATE UNIQUE INDEX idx_threat_news_source_title ON public.threat_news (source, title);

-- Enable RLS
ALTER TABLE public.threat_news ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Allow public read on threat_news"
ON public.threat_news FOR SELECT USING (true);

-- Service role insert
CREATE POLICY "Service role can insert threat_news"
ON public.threat_news FOR INSERT WITH CHECK (true);

-- Enable realtime for toast notifications on new urgent threats
ALTER PUBLICATION supabase_realtime ADD TABLE public.threat_news;

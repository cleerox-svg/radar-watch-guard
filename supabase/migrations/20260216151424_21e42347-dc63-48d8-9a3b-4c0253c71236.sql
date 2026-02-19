
-- Table for Tor exit node IPs (cross-reference against traffic)
CREATE TABLE public.tor_exit_nodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tor_exit_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on tor_exit_nodes"
  ON public.tor_exit_nodes FOR SELECT USING (true);

CREATE POLICY "Service role can insert tor_exit_nodes"
  ON public.tor_exit_nodes FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update tor_exit_nodes"
  ON public.tor_exit_nodes FOR UPDATE USING (true);

-- Add 'ransomwatch' to feed_source_type enum for feed_ingestions tracking
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'threatfox';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'sans_isc';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'ransomwatch';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'tor_nodes';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'mastodon';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'hibp';


-- Table to store AI-generated threat briefings for history and caching
CREATE TABLE public.threat_briefings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing jsonb NOT NULL,
  data_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.threat_briefings ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all briefings
CREATE POLICY "Authenticated users can view briefings"
  ON public.threat_briefings FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authenticated users can create briefings
CREATE POLICY "Authenticated users can create briefings"
  ON public.threat_briefings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Index for quick latest/cached lookups
CREATE INDEX idx_threat_briefings_generated_at ON public.threat_briefings (generated_at DESC);
CREATE INDEX idx_threat_briefings_expires_at ON public.threat_briefings (expires_at);

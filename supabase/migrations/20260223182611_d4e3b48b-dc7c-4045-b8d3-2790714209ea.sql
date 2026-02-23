
-- Agent runs table with TTL (30 days)
CREATE TABLE public.agent_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_type TEXT NOT NULL, -- 'triage', 'hunt', 'response', 'intel', 'copilot'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  trigger_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'scheduled'
  input_params JSONB DEFAULT '{}'::jsonb,
  results JSONB DEFAULT '{}'::jsonb,
  summary TEXT,
  items_processed INTEGER DEFAULT 0,
  items_flagged INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view agent runs"
  ON public.agent_runs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create agent runs"
  ON public.agent_runs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can update agent runs"
  ON public.agent_runs FOR UPDATE
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_agent_runs_type_created ON public.agent_runs(agent_type, created_at DESC);
CREATE INDEX idx_agent_runs_expires ON public.agent_runs(expires_at);

-- Cleanup function for expired runs
CREATE OR REPLACE FUNCTION public.cleanup_expired_agent_runs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.agent_runs WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable realtime for live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_runs;

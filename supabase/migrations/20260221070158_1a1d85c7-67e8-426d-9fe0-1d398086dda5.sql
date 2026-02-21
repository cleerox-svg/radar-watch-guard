
-- Create erasure_actions table to replace mock data in ErasureOrchestrator
CREATE TABLE public.erasure_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL DEFAULT 'network',
  action text NOT NULL,
  target text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  details text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes for dashboard queries
CREATE INDEX idx_erasure_status ON public.erasure_actions (status);
CREATE INDEX idx_erasure_type ON public.erasure_actions (type);
CREATE INDEX idx_erasure_created ON public.erasure_actions (created_at DESC);

-- RLS
ALTER TABLE public.erasure_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view erasure actions"
  ON public.erasure_actions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create erasure actions"
  ON public.erasure_actions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own or admins can update any"
  ON public.erasure_actions FOR UPDATE
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_erasure_actions_updated_at
  BEFORE UPDATE ON public.erasure_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

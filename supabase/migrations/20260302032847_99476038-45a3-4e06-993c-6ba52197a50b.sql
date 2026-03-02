
-- Cross-platform account discoveries table for HITL review
CREATE TABLE public.account_discoveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  influencer_id UUID NOT NULL REFERENCES public.influencer_profiles(id),
  source_account_id UUID REFERENCES public.monitored_accounts(id),
  source_platform TEXT NOT NULL,
  source_username TEXT NOT NULL,
  discovered_platform TEXT NOT NULL,
  discovered_username TEXT NOT NULL,
  discovered_url TEXT NOT NULL,
  discovered_display_name TEXT,
  discovered_bio TEXT,
  discovered_avatar_url TEXT,
  discovered_follower_count INTEGER,
  similarity_score INTEGER DEFAULT 0,
  ai_analysis JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_review',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  agent_run_id UUID REFERENCES public.agent_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate discoveries
CREATE UNIQUE INDEX idx_account_discoveries_unique 
ON public.account_discoveries (influencer_id, discovered_platform, discovered_username);

-- Index for fast lookups
CREATE INDEX idx_account_discoveries_status ON public.account_discoveries (status);
CREATE INDEX idx_account_discoveries_influencer ON public.account_discoveries (influencer_id);

-- Enable RLS
ALTER TABLE public.account_discoveries ENABLE ROW LEVEL SECURITY;

-- Influencers can view their own discoveries
CREATE POLICY "Influencers can view own discoveries"
ON public.account_discoveries FOR SELECT
USING (influencer_id IN (
  SELECT id FROM influencer_profiles WHERE user_id = auth.uid()
));

-- Admins can view all discoveries
CREATE POLICY "Admins can view all discoveries"
ON public.account_discoveries FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Influencers can update own discoveries (for review actions)
CREATE POLICY "Influencers can update own discoveries"
ON public.account_discoveries FOR UPDATE
USING (influencer_id IN (
  SELECT id FROM influencer_profiles WHERE user_id = auth.uid()
));

-- Admins can update all discoveries
CREATE POLICY "Admins can update all discoveries"
ON public.account_discoveries FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert discoveries (from edge function)
CREATE POLICY "Service role can insert discoveries"
ON public.account_discoveries FOR INSERT
WITH CHECK (true);

-- Timestamp trigger
CREATE TRIGGER update_account_discoveries_updated_at
BEFORE UPDATE ON public.account_discoveries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

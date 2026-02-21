
-- Session audit log for tracking all auth events
CREATE TABLE public.session_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_type text NOT NULL DEFAULT 'login',
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick user lookups and time-based queries
CREATE INDEX idx_session_events_user_id ON public.session_events(user_id);
CREATE INDEX idx_session_events_created_at ON public.session_events(created_at DESC);
CREATE INDEX idx_session_events_type ON public.session_events(event_type);

-- Enable RLS
ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions; admins can view all
CREATE POLICY "Users can view own sessions"
  ON public.session_events FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Service role inserts (from edge functions / triggers)
CREATE POLICY "Service role can insert session events"
  ON public.session_events FOR INSERT
  WITH CHECK (true);

-- Admins can delete old session records
CREATE POLICY "Admins can delete session events"
  ON public.session_events FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Add idle_timeout_minutes to profiles for per-user config
ALTER TABLE public.profiles ADD COLUMN idle_timeout_minutes integer DEFAULT 30;

-- Add a revoked_at column to track force-logout state
ALTER TABLE public.profiles ADD COLUMN revoked_at timestamptz;

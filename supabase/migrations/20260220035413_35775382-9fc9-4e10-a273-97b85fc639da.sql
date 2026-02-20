
-- Spam trap hits table — completely isolated from other modules
CREATE TABLE public.spam_trap_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trap_address text NOT NULL,
  sender_email text NOT NULL,
  sender_domain text NOT NULL,
  sender_ip text,
  country text,
  subject text,
  spf_pass boolean DEFAULT false,
  dkim_pass boolean DEFAULT false,
  category text NOT NULL DEFAULT 'spam',
  brand_mentioned text,
  confidence integer NOT NULL DEFAULT 50,
  raw_headers jsonb DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: admin-only access
ALTER TABLE public.spam_trap_hits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can read spam trap hits"
  ON public.spam_trap_hits FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert spam trap hits"
  ON public.spam_trap_hits FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update spam trap hits"
  ON public.spam_trap_hits FOR UPDATE
  USING (true);

-- Index for performance
CREATE INDEX idx_spam_trap_received_at ON public.spam_trap_hits (received_at DESC);
CREATE INDEX idx_spam_trap_category ON public.spam_trap_hits (category);
CREATE INDEX idx_spam_trap_sender_domain ON public.spam_trap_hits (sender_domain);

-- Add to feed_source_type enum
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'spam_trap';

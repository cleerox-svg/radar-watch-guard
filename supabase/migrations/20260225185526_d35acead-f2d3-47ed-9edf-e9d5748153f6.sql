
-- =============================================
-- Agent Approvals: Human-in-the-loop workflow
-- Okta-ready identity fields for future integration
-- =============================================
CREATE TABLE public.agent_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_run_id uuid REFERENCES public.agent_runs(id) ON DELETE CASCADE,
  agent_type text NOT NULL,
  action_type text NOT NULL, -- 'takedown', 'escalation', 'campaign_tag', 'trust_alert', 'evidence_package', 'abuse_triage'
  title text NOT NULL,
  description text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
  priority text NOT NULL DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
  requested_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  -- Okta-ready identity context fields
  identity_provider text DEFAULT 'internal', -- 'internal', 'okta', 'azure_ad', etc.
  identity_context jsonb DEFAULT '{}'::jsonb, -- Okta user profile, risk context, device trust
  policy_decision jsonb DEFAULT '{}'::jsonb, -- Okta policy evaluation results
  mfa_verified boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view approvals"
  ON public.agent_approvals FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create approvals"
  ON public.agent_approvals FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and reviewers can update approvals"
  ON public.agent_approvals FOR UPDATE
  USING (auth.uid() = reviewed_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analyst'::app_role));

-- Enable realtime for live approval queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_approvals;

-- =============================================
-- Evidence Captures: forensic preservation
-- =============================================
CREATE TABLE public.evidence_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  threat_id uuid REFERENCES public.threats(id) ON DELETE SET NULL,
  domain text NOT NULL,
  capture_type text NOT NULL DEFAULT 'full', -- 'full', 'dns', 'whois', 'ssl', 'screenshot', 'headers'
  evidence_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  chain_of_custody jsonb NOT NULL DEFAULT '[]'::jsonb, -- timestamped audit trail
  status text NOT NULL DEFAULT 'captured', -- 'captured', 'reviewed', 'archived', 'legal_hold'
  tagged_by uuid,
  tagged_at timestamptz,
  tags text[] DEFAULT '{}'::text[],
  identity_provider text DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.evidence_captures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view evidence"
  ON public.evidence_captures FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create evidence"
  ON public.evidence_captures FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Analysts and admins can update evidence"
  ON public.evidence_captures FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analyst'::app_role));

-- =============================================
-- Campaign Clusters: coordinated fraud groupings
-- =============================================
CREATE TABLE public.campaign_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name text,
  description text,
  threat_ids uuid[] DEFAULT '{}'::uuid[],
  infrastructure_pattern jsonb DEFAULT '{}'::jsonb, -- shared IPs, ASNs, registrars, SSL issuers
  confidence_score integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft', -- 'draft', 'confirmed', 'active', 'neutralized'
  priority text NOT NULL DEFAULT 'medium',
  confirmed_by uuid,
  confirmed_at timestamptz,
  brands_targeted text[] DEFAULT '{}'::text[],
  ioc_count integer DEFAULT 0,
  identity_provider text DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaigns"
  ON public.campaign_clusters FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create campaigns"
  ON public.campaign_clusters FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Analysts and admins can update campaigns"
  ON public.campaign_clusters FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analyst'::app_role));

-- =============================================
-- Abuse Mailbox Items: reported phishing triage
-- =============================================
CREATE TABLE public.abuse_mailbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_email text NOT NULL,
  subject text,
  sender_email text,
  sender_domain text,
  extracted_urls text[] DEFAULT '{}'::text[],
  extracted_iocs jsonb DEFAULT '{}'::jsonb,
  classification text DEFAULT 'unclassified', -- 'phishing', 'spam', 'legitimate', 'unclassified'
  confidence_score integer DEFAULT 0,
  cross_ref_threat_ids uuid[] DEFAULT '{}'::uuid[],
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'triaged', 'escalated', 'closed'
  triaged_by uuid,
  triaged_at timestamptz,
  auto_actions_taken jsonb DEFAULT '[]'::jsonb,
  identity_provider text DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.abuse_mailbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view abuse mailbox"
  ON public.abuse_mailbox FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can insert abuse mailbox items"
  ON public.abuse_mailbox FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Analysts and admins can update abuse mailbox"
  ON public.abuse_mailbox FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'analyst'::app_role));

-- =============================================
-- Trust Score History: brand trust score tracking
-- =============================================
CREATE TABLE public.trust_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  score integer NOT NULL,
  grade text NOT NULL, -- A+, A, B+, B, C, D, F
  delta integer DEFAULT 0, -- change from previous
  factors jsonb DEFAULT '{}'::jsonb, -- breakdown of score components
  alert_triggered boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trust_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view trust scores"
  ON public.trust_score_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can insert trust scores"
  ON public.trust_score_history FOR INSERT
  WITH CHECK (true);

-- Index for fast brand lookups
CREATE INDEX idx_trust_score_brand_time ON public.trust_score_history(brand, created_at DESC);
CREATE INDEX idx_agent_approvals_status ON public.agent_approvals(status, priority);
CREATE INDEX idx_evidence_captures_domain ON public.evidence_captures(domain);
CREATE INDEX idx_campaign_clusters_status ON public.campaign_clusters(status);
CREATE INDEX idx_abuse_mailbox_status ON public.abuse_mailbox(status);

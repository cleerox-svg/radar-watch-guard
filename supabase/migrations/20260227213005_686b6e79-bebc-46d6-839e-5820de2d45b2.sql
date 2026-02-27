
-- Add 'influencer' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'influencer';

-- ============================================================
-- TABLE: influencer_profiles
-- Stores verified influencer info, subscription tier, widget config
-- ============================================================
CREATE TABLE public.influencer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL,
  brand_name text,
  avatar_url text,
  bio text,
  website_url text,
  subscription_tier text NOT NULL DEFAULT 'free',
  widget_token text UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  report_email text,
  onboarding_completed boolean DEFAULT false,
  max_monitored_accounts integer DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Influencers can view own profile"
  ON public.influencer_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Influencers can update own profile"
  ON public.influencer_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert influencer profiles"
  ON public.influencer_profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all influencer profiles"
  ON public.influencer_profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all influencer profiles"
  ON public.influencer_profiles FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- TABLE: monitored_accounts
-- Legitimate social accounts registered by the influencer
-- ============================================================
CREATE TABLE public.monitored_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  platform_username text NOT NULL,
  platform_url text NOT NULL,
  platform_user_id text,
  verified boolean DEFAULT false,
  last_scanned_at timestamptz,
  scan_status text DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(influencer_id, platform, platform_username)
);

ALTER TABLE public.monitored_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Influencers can view own monitored accounts"
  ON public.monitored_accounts FOR SELECT
  USING (influencer_id IN (SELECT id FROM public.influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Influencers can insert own monitored accounts"
  ON public.monitored_accounts FOR INSERT
  WITH CHECK (influencer_id IN (SELECT id FROM public.influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Influencers can update own monitored accounts"
  ON public.monitored_accounts FOR UPDATE
  USING (influencer_id IN (SELECT id FROM public.influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Influencers can delete own monitored accounts"
  ON public.monitored_accounts FOR DELETE
  USING (influencer_id IN (SELECT id FROM public.influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all monitored accounts"
  ON public.monitored_accounts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- TABLE: impersonation_reports
-- Detected fakes from agent scans or follower submissions
-- ============================================================
CREATE TABLE public.impersonation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  impersonator_username text NOT NULL,
  impersonator_url text,
  impersonator_display_name text,
  similarity_score integer DEFAULT 0,
  source text NOT NULL DEFAULT 'manual',
  reporter_email text,
  reporter_description text,
  evidence_urls text[] DEFAULT '{}'::text[],
  screenshot_url text,
  status text NOT NULL DEFAULT 'new',
  severity text NOT NULL DEFAULT 'medium',
  ai_analysis jsonb DEFAULT '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.impersonation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Influencers can view own reports"
  ON public.impersonation_reports FOR SELECT
  USING (influencer_id IN (SELECT id FROM public.influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Influencers can update own reports"
  ON public.impersonation_reports FOR UPDATE
  USING (influencer_id IN (SELECT id FROM public.influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Anyone can submit reports via widget"
  ON public.impersonation_reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all reports"
  ON public.impersonation_reports FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all reports"
  ON public.impersonation_reports FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- TABLE: takedown_requests
-- Actions initiated against impersonators
-- ============================================================
CREATE TABLE public.takedown_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.impersonation_reports(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  request_type text NOT NULL DEFAULT 'dmca',
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  resolved_at timestamptz,
  platform_case_id text,
  notes text,
  response_data jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.takedown_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Influencers can view own takedowns"
  ON public.takedown_requests FOR SELECT
  USING (influencer_id IN (SELECT id FROM public.influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Influencers can create own takedowns"
  ON public.takedown_requests FOR INSERT
  WITH CHECK (influencer_id IN (SELECT id FROM public.influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Influencers can update own takedowns"
  ON public.takedown_requests FOR UPDATE
  USING (influencer_id IN (SELECT id FROM public.influencer_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all takedowns"
  ON public.takedown_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all takedowns"
  ON public.takedown_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers for updated_at
CREATE TRIGGER update_influencer_profiles_updated_at
  BEFORE UPDATE ON public.influencer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monitored_accounts_updated_at
  BEFORE UPDATE ON public.monitored_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_impersonation_reports_updated_at
  BEFORE UPDATE ON public.impersonation_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_takedown_requests_updated_at
  BEFORE UPDATE ON public.takedown_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create influencer profile on signup with influencer role
CREATE OR REPLACE FUNCTION public.handle_new_influencer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If the user signed up with influencer metadata, create their influencer profile
  IF NEW.raw_user_meta_data->>'account_type' = 'influencer' THEN
    INSERT INTO public.influencer_profiles (user_id, display_name, brand_name)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
      NEW.raw_user_meta_data->>'brand_name'
    );
    -- Assign influencer role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'influencer')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users for influencer auto-creation
CREATE TRIGGER on_influencer_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_influencer();

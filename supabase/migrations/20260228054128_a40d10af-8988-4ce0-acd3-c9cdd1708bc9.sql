
-- Table to store historical profile snapshots from monitored social accounts
-- Each time we fetch profile data, we store a snapshot to track changes over time
CREATE TABLE public.account_profile_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monitored_account_id uuid NOT NULL REFERENCES public.monitored_accounts(id) ON DELETE CASCADE,
  influencer_id uuid NOT NULL REFERENCES public.influencer_profiles(id) ON DELETE CASCADE,
  
  -- Profile identity
  avatar_url text,
  avatar_storage_path text,  -- path in our storage bucket for the downloaded copy
  avatar_hash text,          -- perceptual hash for image comparison (OCR/similarity)
  display_name text,
  bio text,
  
  -- Engagement / reach metrics
  follower_count integer,
  following_count integer,
  post_count integer,
  
  -- Platform-specific details
  verified_on_platform boolean DEFAULT false,
  website_url text,
  location text,
  account_created_at timestamp with time zone,
  
  -- Raw data dump — everything the platform returns
  raw_profile_data jsonb DEFAULT '{}'::jsonb,
  
  -- Change tracking
  changes_detected jsonb DEFAULT '[]'::jsonb,  -- array of field names that changed from previous snapshot
  has_changes boolean DEFAULT false,
  
  -- Timestamps
  captured_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_snapshots_monitored_account ON public.account_profile_snapshots(monitored_account_id, captured_at DESC);
CREATE INDEX idx_snapshots_influencer ON public.account_profile_snapshots(influencer_id);
CREATE INDEX idx_snapshots_has_changes ON public.account_profile_snapshots(has_changes) WHERE has_changes = true;

-- Add current profile fields to monitored_accounts for quick access
ALTER TABLE public.monitored_accounts
  ADD COLUMN IF NOT EXISTS current_avatar_url text,
  ADD COLUMN IF NOT EXISTS current_display_name text,
  ADD COLUMN IF NOT EXISTS current_bio text,
  ADD COLUMN IF NOT EXISTS current_follower_count integer,
  ADD COLUMN IF NOT EXISTS current_following_count integer,
  ADD COLUMN IF NOT EXISTS current_post_count integer,
  ADD COLUMN IF NOT EXISTS current_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_changes_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_profile_fetch_at timestamp with time zone;

-- RLS
ALTER TABLE public.account_profile_snapshots ENABLE ROW LEVEL SECURITY;

-- Admins see all snapshots
CREATE POLICY "Admins can view all snapshots"
  ON public.account_profile_snapshots FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Influencers see their own snapshots
CREATE POLICY "Influencers can view own snapshots"
  ON public.account_profile_snapshots FOR SELECT
  USING (influencer_id IN (
    SELECT id FROM influencer_profiles WHERE user_id = auth.uid()
  ));

-- Service role can insert snapshots (edge functions)
CREATE POLICY "Service role can insert snapshots"
  ON public.account_profile_snapshots FOR INSERT
  WITH CHECK (true);

-- Storage bucket for downloaded avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view avatars (they're profile pictures)
CREATE POLICY "Public read access for avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-avatars');

-- Service role can upload avatars
CREATE POLICY "Service can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-avatars');

-- Service role can overwrite avatars
CREATE POLICY "Service can update avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'profile-avatars');

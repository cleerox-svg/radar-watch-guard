
-- Add risk scoring columns to monitored_accounts
ALTER TABLE public.monitored_accounts
  ADD COLUMN IF NOT EXISTS risk_score integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS risk_category text DEFAULT 'unscored',
  ADD COLUMN IF NOT EXISTS risk_factors jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_risk_scored_at timestamp with time zone DEFAULT NULL;

-- Add index for risk category filtering
CREATE INDEX IF NOT EXISTS idx_monitored_accounts_risk_category ON public.monitored_accounts(risk_category);
CREATE INDEX IF NOT EXISTS idx_monitored_accounts_risk_score ON public.monitored_accounts(risk_score);

COMMENT ON COLUMN public.monitored_accounts.risk_score IS 'AI-calculated imposter risk score 0-100. 0=definitely real, 100=definitely fake';
COMMENT ON COLUMN public.monitored_accounts.risk_category IS 'Category: unscored, legitimate, suspicious, likely_imposter, confirmed_imposter';

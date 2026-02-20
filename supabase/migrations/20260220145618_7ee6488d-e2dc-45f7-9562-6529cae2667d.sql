
-- Add hosting provider intelligence columns to threats table
ALTER TABLE public.threats 
  ADD COLUMN IF NOT EXISTS asn text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS org_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS isp text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS abuse_contact text DEFAULT NULL;

-- Create index for provider trending queries
CREATE INDEX IF NOT EXISTS idx_threats_org_name ON public.threats (org_name) WHERE org_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_threats_first_seen ON public.threats (first_seen);
CREATE INDEX IF NOT EXISTS idx_threats_last_seen ON public.threats (last_seen);

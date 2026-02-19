
-- Table for lead generation from public brand risk scanner
CREATE TABLE public.scan_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  company_name TEXT,
  domain_scanned TEXT NOT NULL,
  risk_grade TEXT,
  risk_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scan_leads ENABLE ROW LEVEL SECURITY;

-- Public insert policy (anyone can submit their email)
CREATE POLICY "Anyone can submit a scan lead"
  ON public.scan_leads
  FOR INSERT
  WITH CHECK (true);

-- No public read — leads are internal data
-- Admin would access via service role key

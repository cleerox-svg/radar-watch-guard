
-- Create scan_leads table for landing page submissions
CREATE TABLE public.scan_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  submission_type TEXT NOT NULL DEFAULT 'brand_scan',
  domain_scanned TEXT,
  scan_grade TEXT,
  scan_score INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scan_leads ENABLE ROW LEVEL SECURITY;

-- Public can insert (anonymous form submissions)
CREATE POLICY "Anyone can submit leads" ON public.scan_leads
FOR INSERT WITH CHECK (true);

-- Only admins can read leads
CREATE POLICY "Admins can view leads" ON public.scan_leads
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update leads
CREATE POLICY "Admins can update leads" ON public.scan_leads
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete leads
CREATE POLICY "Admins can delete leads" ON public.scan_leads
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index on email and created_at
CREATE INDEX idx_scan_leads_email ON public.scan_leads(email);
CREATE INDEX idx_scan_leads_created_at ON public.scan_leads(created_at DESC);

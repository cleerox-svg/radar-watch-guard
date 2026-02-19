-- Add unique constraint on domain to enable upsert deduplication
ALTER TABLE public.threats ADD CONSTRAINT threats_domain_key UNIQUE (domain);
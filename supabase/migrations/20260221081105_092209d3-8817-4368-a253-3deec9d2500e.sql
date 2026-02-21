
-- Add new feed source types to the enum
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'feodo';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'malbazaar';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'blocklist_de';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'ssl_blocklist';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'spamhaus_drop';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'certstream';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'phishtank_community';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'greynoise';

-- Create a feed_schedules table to track cron vs realtime vs manual
CREATE TABLE IF NOT EXISTS public.feed_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_source text NOT NULL UNIQUE,
  feed_name text NOT NULL,
  description text,
  pull_type text NOT NULL DEFAULT 'cron' CHECK (pull_type IN ('cron', 'realtime', 'manual')),
  cron_expression text,
  interval_minutes integer DEFAULT 15,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamp with time zone,
  last_status text DEFAULT 'idle',
  last_records integer DEFAULT 0,
  requires_api_key boolean NOT NULL DEFAULT false,
  api_key_configured boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view feed schedules"
  ON public.feed_schedules FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage feed schedules"
  ON public.feed_schedules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed the feed schedule data
INSERT INTO public.feed_schedules (feed_source, feed_name, description, pull_type, cron_expression, interval_minutes, requires_api_key) VALUES
  ('urlhaus',      'URLhaus',           'Malware distribution URLs from Abuse.ch',        'cron', '*/15 * * * *', 15, false),
  ('phishtank',    'PhishTank',         'Community-verified phishing URLs',                'cron', '*/15 * * * *', 15, false),
  ('openphish',    'OpenPhish',         'Automated phishing URL detection',                'cron', '*/15 * * * *', 15, false),
  ('threatfox',    'ThreatFox',         'C2 servers, botnet IOCs from Abuse.ch',           'cron', '*/15 * * * *', 15, false),
  ('ransomwatch',  'Ransomwatch',       'Ransomware leak site victim tracking',            'cron', '*/30 * * * *', 30, false),
  ('cisa_kev',     'CISA KEV',          'Known Exploited Vulnerabilities catalog',         'cron', '0 */6 * * *',  360, false),
  ('otx',          'AlienVault OTX',    'Community threat intelligence pulses',            'cron', '*/30 * * * *', 30, false),
  ('sans_isc',     'SANS ISC',          'Global port scanning & attack trends',            'cron', '0 */4 * * *',  240, false),
  ('tor_nodes',    'Tor Exit Nodes',    'Active Tor exit node IP addresses',               'cron', '0 */2 * * *',  120, false),
  ('mastodon',     'Mastodon OSINT',    'infosec.exchange #ThreatIntel IOCs',              'cron', '*/15 * * * *', 15, false),
  ('hibp',         'Have I Been Pwned', 'Credential breach exposure checks',               'manual', NULL, NULL, false),
  ('spam_trap',    'Spam Trap Demo',    'Synthetic honeypot phishing data',                 'manual', NULL, NULL, false),
  ('feodo',        'Feodo Tracker',     'Emotet/Dridex/TrickBot botnet C2 servers',        'cron', '0 */3 * * *',  180, false),
  ('malbazaar',    'MalBazaar',         'Malware sample hashes, YARA rules, tags',         'cron', '0 */6 * * *',  360, false),
  ('blocklist_de', 'Blocklist.de',      'IPs attacking SSH, mail, and web services',       'cron', '0 */4 * * *',  240, false),
  ('ssl_blocklist','SSL Blocklist',     'SSL certs used by botnets (Abuse.ch)',            'cron', '0 */6 * * *',  360, false),
  ('spamhaus_drop','Spamhaus DROP',     'Known spam/botnet/C2 IP ranges',                  'cron', '0 */12 * * *', 720, false),
  ('certstream',   'CertStream',        'Real-time certificate transparency monitoring',   'realtime', NULL, NULL, false),
  ('phishtank_community', 'PhishTank Community', 'Extended phishing URL database',         'cron', '0 */6 * * *',  360, true),
  ('greynoise',    'GreyNoise',         'Mass-scanner vs targeted attack classification',  'cron', '0 */4 * * *',  240, true)
ON CONFLICT (feed_source) DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_feed_schedules_updated_at
  BEFORE UPDATE ON public.feed_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

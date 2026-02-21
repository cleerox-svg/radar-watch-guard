
-- Add new feed source types for API-key feeds
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'google_safebrowsing';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'virustotal';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'ipqualityscore';
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'abuseipdb';

-- Insert feed_schedule entries for new API feeds
INSERT INTO public.feed_schedules (feed_name, feed_source, description, pull_type, interval_minutes, cron_expression, requires_api_key, enabled)
VALUES
  ('Google Safe Browsing', 'google_safebrowsing', 'URL reputation checks for phishing/malware (10k/day free)', 'cron', 60, '0 * * * *', true, true),
  ('VirusTotal', 'virustotal', 'Multi-engine URL/domain reputation (500/day free, 4/min)', 'cron', 360, '0 */6 * * *', true, true),
  ('IPQualityScore', 'ipqualityscore', 'Fraud scoring for IPs, emails, domains (5k/mo free)', 'cron', 720, '0 */12 * * *', true, true),
  ('AbuseIPDB', 'abuseipdb', 'IP abuse confidence scoring (1k/day free)', 'cron', 360, '0 */6 * * *', true, true)
ON CONFLICT DO NOTHING;

-- Update existing feeds with proper pull_type classifications
-- These open feeds should be auto (cron) since they need no API key
UPDATE public.feed_schedules SET pull_type = 'cron' WHERE feed_source IN (
  'urlhaus', 'openphish', 'phishtank', 'cisa_kev', 'otx', 'threatfox',
  'sans_isc', 'ransomwatch', 'tor_nodes', 'mastodon', 'feodo',
  'malbazaar', 'blocklist_de', 'ssl_blocklist', 'spamhaus_drop'
) AND pull_type != 'cron';

-- CertStream stays realtime
UPDATE public.feed_schedules SET pull_type = 'realtime' WHERE feed_source = 'certstream';

-- API-key feeds that aren't configured yet stay manual until key is added
-- hibp and spam_trap stay manual
UPDATE public.feed_schedules SET pull_type = 'manual' WHERE feed_source IN ('hibp', 'spam_trap');

-- Add 'ipsum' to the feed_source_type enum
ALTER TYPE public.feed_source_type ADD VALUE IF NOT EXISTS 'ipsum';

-- Add feed_schedules entry for ipsum
INSERT INTO public.feed_schedules (feed_source, feed_name, description, enabled, interval_minutes, cron_expression, pull_type, requires_api_key, api_key_configured)
VALUES ('ipsum', 'IPsum Aggregated Blocklist', 'Aggregated malicious IPs from 30+ blocklists (level 3+ = high confidence)', true, 360, '0 */6 * * *', 'cron', false, false)
ON CONFLICT (feed_source) DO NOTHING;

-- Mark ssl_blocklist as disabled since it is deprecated
UPDATE public.feed_schedules SET enabled = false, last_status = 'deprecated', description = 'DEPRECATED by abuse.ch on 2025-01-03. Replaced by IPsum.' WHERE feed_source = 'ssl_blocklist';
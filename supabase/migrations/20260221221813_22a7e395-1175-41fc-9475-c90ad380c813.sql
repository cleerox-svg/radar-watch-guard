
CREATE OR REPLACE FUNCTION public.get_hosting_provider_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH provider_agg AS (
    SELECT
      COALESCE(org_name, isp, 'Unknown Provider') AS org,
      COUNT(*) AS total_threats,
      COUNT(*) FILTER (WHERE last_seen >= NOW() - INTERVAL '7 days') AS recent_threats,
      COUNT(*) FILTER (WHERE last_seen >= NOW() - INTERVAL '30 days' AND last_seen < NOW() - INTERVAL '7 days') AS older_threats,
      ARRAY_AGG(DISTINCT ip_address) FILTER (WHERE ip_address IS NOT NULL) AS ips,
      ARRAY_AGG(DISTINCT asn) FILTER (WHERE asn IS NOT NULL) AS asns,
      ARRAY_AGG(DISTINCT isp) FILTER (WHERE isp IS NOT NULL) AS isps,
      ARRAY_AGG(DISTINCT abuse_contact) FILTER (WHERE abuse_contact IS NOT NULL) AS abuse_contacts,
      ARRAY_AGG(DISTINCT domain) AS domains,
      ARRAY_AGG(DISTINCT country) FILTER (WHERE country IS NOT NULL) AS countries,
      ARRAY_AGG(DISTINCT attack_type) AS attack_types,
      JSONB_OBJECT_AGG(sev, sev_count) AS severity_counts
    FROM (
      SELECT
        t.*,
        t.severity AS sev,
        COUNT(*) OVER (PARTITION BY COALESCE(org_name, isp, 'Unknown Provider'), t.severity) AS sev_count
      FROM threats t
      WHERE COALESCE(org_name, isp) IS NOT NULL
    ) sub
    GROUP BY COALESCE(org_name, isp, 'Unknown Provider')
    HAVING COUNT(*) >= 2
  ),
  worst_now AS (
    SELECT jsonb_agg(to_jsonb(p) ORDER BY p.recent_threats DESC)
    FROM (SELECT * FROM provider_agg WHERE recent_threats > 0 ORDER BY recent_threats DESC LIMIT 20) p
  ),
  previously_bad AS (
    SELECT jsonb_agg(to_jsonb(p) ORDER BY p.older_threats DESC)
    FROM (SELECT * FROM provider_agg WHERE older_threats > 0 AND recent_threats <= 1 ORDER BY older_threats DESC LIMIT 20) p
  ),
  most_improved AS (
    SELECT jsonb_agg(to_jsonb(p) ORDER BY (p.older_threats - p.recent_threats) DESC)
    FROM (SELECT * FROM provider_agg WHERE older_threats > 2 AND recent_threats < older_threats ORDER BY (older_threats - recent_threats) DESC LIMIT 20) p
  )
  SELECT jsonb_build_object(
    'worst_now', COALESCE((SELECT * FROM worst_now), '[]'::jsonb),
    'previously_bad', COALESCE((SELECT * FROM previously_bad), '[]'::jsonb),
    'most_improved', COALESCE((SELECT * FROM most_improved), '[]'::jsonb),
    'provider_count', (SELECT COUNT(*) FROM provider_agg)
  );
$$;

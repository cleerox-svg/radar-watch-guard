-- Tighten ato_events: require authentication for SELECT
DROP POLICY IF EXISTS "Allow public read on ato_events" ON public.ato_events;
CREATE POLICY "Authenticated users can view ato_events"
  ON public.ato_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Tighten breach_checks: require authentication for SELECT
DROP POLICY IF EXISTS "Public read access for breach_checks" ON public.breach_checks;
CREATE POLICY "Authenticated users can view breach_checks"
  ON public.breach_checks
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
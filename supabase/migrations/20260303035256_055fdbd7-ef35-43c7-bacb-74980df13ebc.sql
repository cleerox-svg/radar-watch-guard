-- Allow admins to delete influencer profiles
CREATE POLICY "Admins can delete influencer profiles"
ON public.influencer_profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete impersonation reports
CREATE POLICY "Admins can delete reports"
ON public.impersonation_reports
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete account discoveries
CREATE POLICY "Admins can delete discoveries"
ON public.account_discoveries
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete account profile snapshots
CREATE POLICY "Admins can delete snapshots"
ON public.account_profile_snapshots
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
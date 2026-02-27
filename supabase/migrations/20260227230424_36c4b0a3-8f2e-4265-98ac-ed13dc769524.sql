
-- Allow admins to insert monitored accounts for any influencer
CREATE POLICY "Admins can insert monitored accounts"
ON public.monitored_accounts
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update any monitored account
CREATE POLICY "Admins can update all monitored accounts"
ON public.monitored_accounts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete any monitored account
CREATE POLICY "Admins can delete all monitored accounts"
ON public.monitored_accounts
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

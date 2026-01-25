-- Recreate the policy that was dropped with correct function argument order
CREATE POLICY "Admins and managers can manage dairy_settings"
ON public.dairy_settings
FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin', 'manager']::user_role[]))
WITH CHECK (has_any_role(auth.uid(), ARRAY['super_admin', 'manager']::user_role[]));
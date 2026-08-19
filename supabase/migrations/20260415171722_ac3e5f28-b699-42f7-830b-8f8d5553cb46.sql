
-- Allow admin to update any profile
CREATE POLICY "Admin can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admin to update withdrawal request details (account info)
CREATE POLICY "Admin can update withdrawal requests"
ON public.withdrawal_requests FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

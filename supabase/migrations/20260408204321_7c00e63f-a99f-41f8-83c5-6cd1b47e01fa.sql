
CREATE POLICY "Admin can update payments"
ON public.payments FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

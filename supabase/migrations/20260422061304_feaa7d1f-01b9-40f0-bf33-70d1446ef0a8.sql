-- Allow admins to insert FPC codes (for regenerate/manual creation)
CREATE POLICY "Admin can insert fpc codes"
ON public.fpc_codes FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete FPC codes (for regenerate flow)
CREATE POLICY "Admin can delete fpc codes"
ON public.fpc_codes FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
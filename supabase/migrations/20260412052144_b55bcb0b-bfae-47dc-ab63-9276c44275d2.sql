
-- Allow admins to view all profiles
CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all daily tasks
CREATE POLICY "Admin can view all daily tasks"
ON public.daily_tasks
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all spin history
CREATE POLICY "Admin can view all spin history"
ON public.spin_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

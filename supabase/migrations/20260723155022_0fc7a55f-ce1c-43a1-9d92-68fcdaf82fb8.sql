DROP POLICY IF EXISTS "Admin can view all daily tasks" ON public.daily_tasks;
CREATE POLICY "Admin can view all daily tasks" ON public.daily_tasks FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admin can delete fpc codes" ON public.fpc_codes;
CREATE POLICY "Admin can delete fpc codes" ON public.fpc_codes FOR DELETE TO authenticated USING (public.is_current_user_admin());
DROP POLICY IF EXISTS "Admin can insert fpc codes" ON public.fpc_codes;
CREATE POLICY "Admin can insert fpc codes" ON public.fpc_codes FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());
DROP POLICY IF EXISTS "Admin can update all fpc codes" ON public.fpc_codes;
CREATE POLICY "Admin can update all fpc codes" ON public.fpc_codes FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
DROP POLICY IF EXISTS "Admin can view all fpc codes" ON public.fpc_codes;
CREATE POLICY "Admin can view all fpc codes" ON public.fpc_codes FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admin can update payments" ON public.payments;
CREATE POLICY "Admin can update payments" ON public.payments FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
DROP POLICY IF EXISTS "Admin can view all payments" ON public.payments;
CREATE POLICY "Admin can view all payments" ON public.payments FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
CREATE POLICY "Admin can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admin can view all spin history" ON public.spin_history;
CREATE POLICY "Admin can view all spin history" ON public.spin_history FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admin can update withdrawal requests" ON public.withdrawal_requests;
CREATE POLICY "Admin can update withdrawal requests" ON public.withdrawal_requests FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
DROP POLICY IF EXISTS "Admin can view all withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Admin can view all withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated USING (public.is_current_user_admin() OR auth.uid() = user_id);

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
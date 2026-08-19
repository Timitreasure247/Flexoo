-- ============ FPC CODES ============
DROP POLICY IF EXISTS "Admin can insert fpc codes" ON public.fpc_codes;
DROP POLICY IF EXISTS "Admin can update all fpc codes" ON public.fpc_codes;
DROP POLICY IF EXISTS "Admin can delete fpc codes" ON public.fpc_codes;
DROP POLICY IF EXISTS "Users can update own fpc codes" ON public.fpc_codes;

CREATE POLICY "Admin can insert fpc codes"
ON public.fpc_codes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update all fpc codes"
ON public.fpc_codes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete fpc codes"
ON public.fpc_codes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Users may only mark their own code used (cannot change ownership)
CREATE POLICY "Users can mark own fpc codes used"
ON public.fpc_codes FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============ PAYMENTS ============
DROP POLICY IF EXISTS "Admin can update payments" ON public.payments;

CREATE POLICY "Admin can update payments"
ON public.payments FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Block non-admin users from updating payments (insert remains owner-scoped)
-- (No user-update policy exists, so updates are admin-only by default.)

-- ============ PROFILES ============
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;

CREATE POLICY "Admin can update all profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ WITHDRAWAL REQUESTS ============
DROP POLICY IF EXISTS "Admin can update withdrawal requests" ON public.withdrawal_requests;
DROP POLICY IF EXISTS "Admin can view all withdrawals" ON public.withdrawal_requests;

CREATE POLICY "Admin can view all withdrawals"
ON public.withdrawal_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

CREATE POLICY "Admin can update withdrawal requests"
ON public.withdrawal_requests FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 1) Replace broad profiles referral lookup policy with a SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Anyone can look up profiles by referral code" ON public.profiles;

CREATE OR REPLACE FUNCTION public.lookup_referrer_id(p_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE referral_code = p_code LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.lookup_referrer_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_referrer_id(text) TO anon, authenticated;

-- 2) user_roles: explicit restrictive policies (only admins can modify)
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Storage: receipts bucket — restrict listing/updates/deletes to owner + admin
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;

CREATE POLICY "Users view own receipts" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Users update own receipts" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Users delete own receipts" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- 4) Revoke anon EXECUTE on admin/helper functions (they verify admin internally,
--    but they should not be reachable by anonymous users at all)
REVOKE EXECUTE ON FUNCTION public.admin_create_fpc_code(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_fpc_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_regenerate_fpc_code(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_fpc_used(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_payment(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_payment_status(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_setting(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_withdrawal(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_withdrawal_account(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_fpc_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_referral(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_payment_confirmed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

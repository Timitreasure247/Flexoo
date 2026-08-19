
-- Ensure receipts bucket has owner-scoped UPDATE/DELETE policies and admin override
DROP POLICY IF EXISTS "Users can update own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update any receipt" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete any receipt" ON storage.objects;

CREATE POLICY "Users can update own receipts"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'receipts' AND owner = auth.uid())
WITH CHECK (bucket_id = 'receipts' AND owner = auth.uid());

CREATE POLICY "Users can delete own receipts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts' AND owner = auth.uid());

CREATE POLICY "Admins can update any receipt"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'receipts' AND public.is_current_user_admin())
WITH CHECK (bucket_id = 'receipts' AND public.is_current_user_admin());

CREATE POLICY "Admins can delete any receipt"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'receipts' AND public.is_current_user_admin());

-- Revoke anon EXECUTE on all SECURITY DEFINER public functions
REVOKE EXECUTE ON FUNCTION public.admin_regenerate_fpc_code(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.process_referral(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_withdrawal(uuid, text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_payment_status(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, numeric, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_payment_confirmed() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_setting(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.lookup_referrer_id(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_payment(uuid, numeric, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_withdrawal_account(uuid, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_create_fpc_code(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_delete_fpc_code(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_fpc_used(uuid, boolean) FROM anon, public;

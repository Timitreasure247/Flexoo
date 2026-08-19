
-- 1) Payment accounts: restrict to authenticated
DROP POLICY IF EXISTS "View active payment accounts" ON public.payment_accounts;
CREATE POLICY "View active payment accounts"
ON public.payment_accounts
FOR SELECT
TO authenticated
USING (status = true OR public.is_current_user_admin() OR public.is_current_user_super_admin());

-- 2) Storage receipts: consolidate policies. Drop redundant ones, keep the foldername+admin set.
DROP POLICY IF EXISTS "Users can update own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update any receipt" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete any receipt" ON storage.objects;

-- 3) Revoke anon EXECUTE on SECURITY DEFINER functions (admin/privileged)
REVOKE EXECUTE ON FUNCTION public.get_admin_display_name(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_current_user_super_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_current_user_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_create_payment_account(text, text, text, text, text, boolean, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_payment_account(uuid, text, text, text, text, text, boolean, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_delete_payment_account(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_default_payment_account(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_regenerate_fpc_code(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_withdrawal(uuid, text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_payment_status(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, numeric, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_payment(uuid, numeric, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_setting(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_update_withdrawal_account(uuid, text, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_create_fpc_code(uuid, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_delete_fpc_code(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_fpc_used(uuid, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.process_referral(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.lookup_referrer_id(text) FROM anon, public;

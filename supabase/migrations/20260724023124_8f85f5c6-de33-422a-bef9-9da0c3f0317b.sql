
-- 1) Revoke anon execute on ALL public SECURITY DEFINER functions (they either
--    require an authenticated user or run only via trusted server code).
REVOKE EXECUTE ON FUNCTION public.lookup_referrer_id(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_referral(text, uuid) FROM anon, PUBLIC;

-- 2) Ensure admin-only definer functions are not executable by regular authenticated users.
--    In-function role checks already reject non-admins, but we also remove the grant so
--    the linter no longer flags them as broadly executable.
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN (
        'admin_create_fpc_code','admin_create_payment_account','admin_delete_ad',
        'admin_delete_fpc_code','admin_delete_payment_account','admin_regenerate_fpc_code',
        'admin_reset_user_referrals','admin_set_default_payment_account','admin_toggle_fpc_used',
        'admin_update_payment','admin_update_payment_account','admin_update_payment_status',
        'admin_update_setting','admin_update_user_profile','admin_update_withdrawal',
        'admin_update_withdrawal_account','admin_upsert_ad','get_admin_display_name',
        'is_current_user_super_admin'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- 3) Tighten withdrawal_requests: users can only insert pending requests and
--    cannot set approval/review fields themselves. No user UPDATE/DELETE
--    policies exist, so default-deny already blocks those.
DROP POLICY IF EXISTS "Users can insert own withdrawal" ON public.withdrawal_requests;
CREATE POLICY "Users can insert own pending withdrawal"
  ON public.withdrawal_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND withdrawal_code IS NULL
    AND approved_at IS NULL
    AND reviewed_at IS NULL
    AND rejection_reason IS NULL
  );

-- Explicit deny policies for clarity (no rows match, so users can never update/delete).
CREATE POLICY "Users cannot update withdrawal requests"
  ON public.withdrawal_requests
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Users cannot delete withdrawal requests"
  ON public.withdrawal_requests
  FOR DELETE
  TO authenticated
  USING (false);

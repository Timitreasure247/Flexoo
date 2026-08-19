
-- Defense-in-depth: revoke public/anon EXECUTE on privileged SECURITY DEFINER functions.
-- Each function already re-verifies the caller's role internally, but we tighten the
-- surface area so unauthenticated / non-admin roles cannot call them at all.

DO $$
DECLARE
  fn text;
  admin_fns text[] := ARRAY[
    'admin_update_setting(text,text)',
    'admin_delete_fpc_code(uuid)',
    'admin_update_withdrawal_account(uuid,text,text,text)',
    'admin_create_fpc_code(uuid,uuid,text)',
    'admin_toggle_fpc_used(uuid,boolean)',
    'admin_regenerate_fpc_code(uuid)',
    'admin_delete_payment_account(uuid)',
    'admin_create_payment_account(text,text,text,text,text,boolean,boolean)',
    'admin_update_payment_account(uuid,text,text,text,text,text,boolean,boolean)',
    'admin_set_default_payment_account(uuid)',
    'admin_update_withdrawal(uuid,text,uuid)',
    'admin_update_payment(uuid,numeric,text,text)',
    'admin_update_payment_status(uuid,text)',
    'admin_update_user_profile(uuid,numeric,text)'
  ];
BEGIN
  FOREACH fn IN ARRAY admin_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;

-- Trigger-only functions: no API caller should invoke these directly.
REVOKE ALL ON FUNCTION public.handle_new_user()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_payment_confirmed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_fpc_code()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_referral_code()   FROM PUBLIC, anon, authenticated;

-- process_referral is called during signup flow; keep it callable by anon+authenticated.
-- lookup_referrer_id is used to validate referral codes at signup; keep public.
-- has_role / is_current_user_admin / is_current_user_super_admin / get_admin_display_name
-- are needed by RLS and the UI; keep default execute.

-- Lock down app_settings reads: only signed-in users can read config values.
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read settings"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.app_settings FROM anon;
GRANT  SELECT ON public.app_settings TO authenticated;

-- payment_accounts: writes are performed exclusively via admin_* SECURITY DEFINER
-- RPCs which enforce the super_admin check. Add explicit-deny write policies so
-- direct PostgREST writes are impossible even if a GRANT is ever widened.
DROP POLICY IF EXISTS "Block direct inserts on payment_accounts" ON public.payment_accounts;
DROP POLICY IF EXISTS "Block direct updates on payment_accounts" ON public.payment_accounts;
DROP POLICY IF EXISTS "Block direct deletes on payment_accounts" ON public.payment_accounts;

CREATE POLICY "Block direct inserts on payment_accounts"
  ON public.payment_accounts FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Block direct updates on payment_accounts"
  ON public.payment_accounts FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Block direct deletes on payment_accounts"
  ON public.payment_accounts FOR DELETE TO authenticated, anon
  USING (false);

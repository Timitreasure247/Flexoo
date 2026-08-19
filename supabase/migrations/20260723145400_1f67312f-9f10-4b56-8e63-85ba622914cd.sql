
-- 1) Lock down app_settings: only admins can read all rows; non-admins get no direct access.
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Authenticated can read app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public read app settings" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_select_all" ON public.app_settings;
DROP POLICY IF EXISTS "Admins read app settings" ON public.app_settings;
CREATE POLICY "Admins read app settings" ON public.app_settings
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

-- Public config keys still readable to anon+authenticated via a SECURITY DEFINER RPC allowlist
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE(key text, value text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT key, value FROM public.app_settings
  WHERE key IN (
    'referral_reward','referral_goal','free_code_enabled',
    'withdrawal_code_price','pay_with_transfer_link',
    'bank_name','account_name','account_number','payment_instructions',
    'whatsapp_url','telegram_url','support_email','support_phone','ad_video_ids',
    'milestone_10_reward','milestone_25_reward','milestone_50_reward'
  );
$$;
REVOKE ALL ON FUNCTION public.get_public_settings() FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;

-- 2) Revoke EXECUTE on SECURITY DEFINER functions from anon where not needed.
-- Admin-only functions: revoke from anon AND authenticated (admin check runs inside, still callable by role checks — but only admins get past)
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'admin_regenerate_fpc_code(uuid)',
    'admin_update_payment_status(uuid,text)',
    'admin_update_user_profile(uuid,numeric,text)',
    'admin_update_withdrawal_account(uuid,text,text,text)',
    'admin_delete_fpc_code(uuid)',
    'admin_create_fpc_code(uuid,uuid,text)',
    'admin_toggle_fpc_used(uuid,boolean)',
    'admin_update_setting(text,text)',
    'admin_update_payment(uuid,numeric,text,text)',
    'admin_create_payment_account(text,text,text,text,text,boolean,boolean)',
    'admin_update_payment_account(uuid,text,text,text,text,text,boolean,boolean)',
    'admin_delete_payment_account(uuid)',
    'admin_set_default_payment_account(uuid)',
    'admin_upsert_ad(uuid,text,numeric,text,integer,boolean)',
    'admin_delete_ad(uuid)',
    'admin_reset_user_referrals(uuid)',
    'admin_update_withdrawal(uuid,text,uuid)',
    'admin_update_withdrawal(uuid,text,uuid,text)',
    'get_admin_display_name(uuid)',
    'is_current_user_super_admin()'
  ]) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;

-- Auth-only user functions: revoke from anon, keep authenticated
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'complete_ad(uuid)',
    'claim_free_withdrawal_code()',
    'get_referral_stats(uuid)',
    'is_current_user_admin()',
    'get_public_settings()'
  ]) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;

-- Utility/internal SECURITY DEFINER functions: revoke from public/anon/authenticated.
-- These are used by triggers or other definer functions and don't need direct API access.
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'handle_payment_confirmed()',
    'handle_new_user()',
    'has_role(uuid,app_role)'
  ]) LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;

-- Signup-flow functions must remain callable by anon
GRANT EXECUTE ON FUNCTION public.lookup_referrer_id(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_referral(text, uuid) TO anon, authenticated;

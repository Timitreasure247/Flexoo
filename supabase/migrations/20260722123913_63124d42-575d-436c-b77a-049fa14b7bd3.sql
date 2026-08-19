
-- 1) Revoke EXECUTE from anon and PUBLIC on all SECURITY DEFINER functions in public schema
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon;', r.proname, r.args);
  END LOOP;
END $$;

-- 2) app_settings: restrict read to a public whitelist for authenticated; admins can read all
DROP POLICY IF EXISTS "Authenticated users can read settings" ON public.app_settings;

CREATE POLICY "Authenticated read public settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (
  key IN (
    'whatsapp_url','telegram_url','support_email','support_phone',
    'ad_video_ids','withdrawal_code_price','pay_with_transfer_link',
    'bank_name','account_name','account_number','payment_instructions',
    'referral_reward','referral_goal','free_code_enabled',
    'milestone_10_reward','milestone_25_reward','milestone_50_reward'
  )
);

CREATE POLICY "Admins can read all settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

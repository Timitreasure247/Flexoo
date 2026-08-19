-- Signup bonus: atomic, retry-safe backend function.
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_one_signup_bonus_per_user
  ON public.transactions (user_id, type)
  WHERE type = 'signup_bonus';

CREATE OR REPLACE FUNCTION public.claim_signup_bonus()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_bonus numeric := 170000;
  v_tx_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text));

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE user_id = v_uid
  FOR UPDATE;

  IF v_profile.id IS NULL THEN
    INSERT INTO public.profiles (user_id, full_name, username, phone, referral_code, bonus_balance)
    VALUES (
      v_uid,
      COALESCE(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
      COALESCE(auth.jwt() -> 'user_metadata' ->> 'username', ''),
      COALESCE(auth.jwt() -> 'user_metadata' ->> 'phone', ''),
      public.generate_referral_code(),
      0
    )
    RETURNING * INTO v_profile;
  END IF;

  SELECT id INTO v_tx_id
  FROM public.transactions
  WHERE user_id = v_uid AND type = 'signup_bonus'
  LIMIT 1;

  IF v_tx_id IS NULL THEN
    UPDATE public.profiles
    SET bonus_balance = bonus_balance + v_bonus,
        updated_at = now()
    WHERE id = v_profile.id
    RETURNING * INTO v_profile;

    INSERT INTO public.transactions (user_id, type, amount, description, metadata)
    VALUES (
      v_uid,
      'signup_bonus',
      v_bonus,
      'Welcome signup bonus credited.',
      jsonb_build_object('source', 'claim_signup_bonus', 'profile_id', v_profile.id)
    )
    RETURNING id INTO v_tx_id;
  END IF;

  RETURN jsonb_build_object(
    'profile_id', v_profile.id,
    'full_name', v_profile.full_name,
    'referral_code', v_profile.referral_code,
    'bonus_balance', v_profile.bonus_balance,
    'bonus_amount', v_bonus,
    'transaction_id', v_tx_id,
    'already_credited', EXISTS (
      SELECT 1 FROM public.transactions
      WHERE user_id = v_uid AND type = 'signup_bonus' AND id = v_tx_id
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_signup_bonus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_signup_bonus() TO authenticated, service_role;

-- Keep profile creation helper aligned with transaction history for future server-side use.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile_id uuid;
  v_bonus numeric := 170000;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, username, phone, referral_code, bonus_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    public.generate_referral_code(),
    v_bonus
  )
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_profile_id;

  IF v_profile_id IS NOT NULL THEN
    INSERT INTO public.transactions (user_id, type, amount, description, metadata)
    VALUES (
      NEW.id,
      'signup_bonus',
      v_bonus,
      'Welcome signup bonus credited.',
      jsonb_build_object('source', 'handle_new_user', 'profile_id', v_profile_id)
    )
    ON CONFLICT (user_id, type) WHERE type = 'signup_bonus' DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- One administrator role: super_admin becomes an admin-only compatibility alias.
UPDATE public.user_roles SET role = 'admin'::public.app_role WHERE role::text = 'super_admin';

CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.is_current_user_admin();
$function$;

REVOKE EXECUTE ON FUNCTION public.is_current_user_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO authenticated, service_role;

-- Full-system administrator action audit log.
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  admin_name text,
  action text NOT NULL,
  target_table text,
  target_id text,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view admin audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins view admin audit logs"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_target_table text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin uuid := auth.uid();
BEGIN
  IF v_admin IS NULL OR NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  INSERT INTO public.admin_audit_logs (admin_id, admin_name, action, target_table, target_id, details)
  VALUES (v_admin, public.get_admin_display_name(v_admin), p_action, p_target_table, p_target_id, p_details);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) TO authenticated, service_role;

-- Admin payment account functions now require the single admin role and log actions.
CREATE OR REPLACE FUNCTION public.admin_create_payment_account(p_bank_name text, p_account_name text, p_account_number text, p_payment_method text, p_qr_code text, p_is_default boolean, p_status boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_admin uuid := auth.uid();
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized: admin role required'; END IF;
  IF p_is_default THEN UPDATE public.payment_accounts SET is_default = false WHERE is_default = true; END IF;
  INSERT INTO public.payment_accounts (bank_name, account_name, account_number, payment_method, qr_code, is_default, status)
    VALUES (p_bank_name, p_account_name, p_account_number, p_payment_method, NULLIF(p_qr_code,''), p_is_default, p_status)
    RETURNING id INTO v_id;
  INSERT INTO public.payment_account_audit (payment_account_id, admin_id, admin_name, action, new_values)
    VALUES (v_id, v_admin, public.get_admin_display_name(v_admin), 'create',
      jsonb_build_object('bank_name',p_bank_name,'account_name',p_account_name,'account_number',p_account_number,
        'payment_method',p_payment_method,'qr_code',p_qr_code,'is_default',p_is_default,'status',p_status));
  PERFORM public.log_admin_action('create_payment_account', 'payment_accounts', v_id::text,
    jsonb_build_object('payment_method', p_payment_method, 'is_default', p_is_default, 'status', p_status));
  RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_update_payment_account(p_id uuid, p_bank_name text, p_account_name text, p_account_number text, p_payment_method text, p_qr_code text, p_is_default boolean, p_status boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_admin uuid := auth.uid(); v_old RECORD;
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized: admin role required'; END IF;
  SELECT * INTO v_old FROM public.payment_accounts WHERE id = p_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF p_is_default AND NOT v_old.is_default THEN
    UPDATE public.payment_accounts SET is_default = false WHERE is_default = true;
  END IF;
  UPDATE public.payment_accounts
    SET bank_name=p_bank_name, account_name=p_account_name, account_number=p_account_number,
        payment_method=p_payment_method, qr_code=NULLIF(p_qr_code,''), is_default=p_is_default, status=p_status
    WHERE id = p_id;
  INSERT INTO public.payment_account_audit (payment_account_id, admin_id, admin_name, action, previous_values, new_values)
    VALUES (p_id, v_admin, public.get_admin_display_name(v_admin), 'update',
      to_jsonb(v_old) - 'created_at' - 'updated_at',
      jsonb_build_object('bank_name',p_bank_name,'account_name',p_account_name,'account_number',p_account_number,
        'payment_method',p_payment_method,'qr_code',p_qr_code,'is_default',p_is_default,'status',p_status));
  PERFORM public.log_admin_action('update_payment_account', 'payment_accounts', p_id::text,
    jsonb_build_object('payment_method', p_payment_method, 'is_default', p_is_default, 'status', p_status));
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_delete_payment_account(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_admin uuid := auth.uid(); v_old RECORD;
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized: admin role required'; END IF;
  SELECT * INTO v_old FROM public.payment_accounts WHERE id = p_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  DELETE FROM public.payment_accounts WHERE id = p_id;
  INSERT INTO public.payment_account_audit (payment_account_id, admin_id, admin_name, action, previous_values)
    VALUES (p_id, v_admin, public.get_admin_display_name(v_admin), 'delete', to_jsonb(v_old) - 'created_at' - 'updated_at');
  PERFORM public.log_admin_action('delete_payment_account', 'payment_accounts', p_id::text, to_jsonb(v_old) - 'created_at' - 'updated_at');
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_set_default_payment_account(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized: admin role required'; END IF;
  UPDATE public.payment_accounts SET is_default = false WHERE is_default = true;
  UPDATE public.payment_accounts SET is_default = true WHERE id = p_id;
  INSERT INTO public.payment_account_audit (payment_account_id, admin_id, admin_name, action, new_values)
    VALUES (p_id, v_admin, public.get_admin_display_name(v_admin), 'set_default', jsonb_build_object('is_default', true));
  PERFORM public.log_admin_action('set_default_payment_account', 'payment_accounts', p_id::text, jsonb_build_object('is_default', true));
END; $function$;

-- Log existing administrator RPC actions.
CREATE OR REPLACE FUNCTION public.admin_update_setting(p_key text, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.app_settings (key, value, updated_at) VALUES (p_key, p_value, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  PERFORM public.log_admin_action('update_setting', 'app_settings', p_key, jsonb_build_object('key', p_key));
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_update_user_profile(p_profile_id uuid, p_balance numeric, p_level text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_balance IS NULL OR p_balance < 0 THEN RAISE EXCEPTION 'Invalid balance'; END IF;
  IF p_level NOT IN ('bronze','silver','gold') THEN RAISE EXCEPTION 'Invalid level'; END IF;
  UPDATE public.profiles SET bonus_balance = p_balance, level = p_level WHERE id = p_profile_id;
  PERFORM public.log_admin_action('update_user_profile', 'profiles', p_profile_id::text, jsonb_build_object('balance', p_balance, 'level', p_level));
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_update_payment_status(p_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_status NOT IN ('pending','confirmed','rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.payments SET status=p_status, reviewed_at=now() WHERE id = p_id;
  PERFORM public.log_admin_action('update_payment_status', 'payments', p_id::text, jsonb_build_object('status', p_status));
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_update_payment(p_id uuid, p_amount numeric, p_status text, p_receipt_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_status NOT IN ('pending','confirmed','rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  UPDATE public.payments SET amount=p_amount, status=p_status, receipt_url=NULLIF(p_receipt_url,''),
    reviewed_at = CASE WHEN p_status <> 'pending' THEN now() ELSE reviewed_at END WHERE id = p_id;
  PERFORM public.log_admin_action('update_payment', 'payments', p_id::text, jsonb_build_object('amount', p_amount, 'status', p_status));
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_update_withdrawal(withdrawal_id uuid, new_status text, admin_user_id uuid, reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE req RECORD; v_code text;
BEGIN
  IF admin_user_id IS DISTINCT FROM auth.uid() OR NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized: admin role required'; END IF;
  SELECT * INTO req FROM public.withdrawal_requests WHERE id = withdrawal_id;
  IF req IS NULL THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;
  IF new_status = 'approved' THEN
    v_code := 'FPC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    UPDATE public.withdrawal_requests SET status='approved', withdrawal_code=v_code, approved_at=now(), reviewed_at=now(), rejection_reason=NULL WHERE id = withdrawal_id;
  ELSIF new_status = 'rejected' THEN
    UPDATE public.withdrawal_requests SET status='rejected', reviewed_at=now(), rejection_reason=NULLIF(trim(coalesce(reason,'')),'') WHERE id = withdrawal_id;
    UPDATE public.profiles SET bonus_balance = bonus_balance + req.amount WHERE user_id = req.user_id;
  ELSE RAISE EXCEPTION 'Invalid status'; END IF;
  PERFORM public.log_admin_action('update_withdrawal', 'withdrawal_requests', withdrawal_id::text, jsonb_build_object('status', new_status, 'reason', reason));
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_update_withdrawal(withdrawal_id uuid, new_status text, admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.admin_update_withdrawal(withdrawal_id, new_status, admin_user_id, NULL);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_update_withdrawal_account(p_id uuid, p_bank text, p_account_number text, p_account_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.withdrawal_requests SET bank_name=p_bank, account_number=p_account_number, account_name=p_account_name WHERE id=p_id;
  PERFORM public.log_admin_action('update_withdrawal_account', 'withdrawal_requests', p_id::text, jsonb_build_object('bank_name', p_bank));
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_toggle_fpc_used(p_id uuid, p_used boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.fpc_codes SET used=p_used, used_at=CASE WHEN p_used THEN now() ELSE NULL END,
    used_for_withdrawal_id = CASE WHEN p_used THEN used_for_withdrawal_id ELSE NULL END WHERE id = p_id;
  PERFORM public.log_admin_action('toggle_fpc_used', 'fpc_codes', p_id::text, jsonb_build_object('used', p_used));
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_regenerate_fpc_code(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_user uuid; v_payment uuid; v_new_code text;
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT user_id, payment_id INTO v_user, v_payment FROM public.fpc_codes WHERE id = p_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Code not found'; END IF;
  v_new_code := public.generate_fpc_code();
  DELETE FROM public.fpc_codes WHERE id = p_id;
  INSERT INTO public.fpc_codes (user_id, payment_id, code) VALUES (v_user, v_payment, v_new_code);
  PERFORM public.log_admin_action('regenerate_fpc_code', 'fpc_codes', p_id::text, jsonb_build_object('user_id', v_user, 'payment_id', v_payment));
  RETURN v_new_code;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_delete_fpc_code(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.fpc_codes WHERE id = p_id;
  PERFORM public.log_admin_action('delete_fpc_code', 'fpc_codes', p_id::text, NULL);
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_create_fpc_code(p_user_id uuid, p_payment_id uuid, p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_pay_user uuid;
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_code !~ '^FPC-[A-Z0-9]{6,16}$' THEN RAISE EXCEPTION 'Invalid code format'; END IF;
  SELECT user_id INTO v_pay_user FROM public.payments WHERE id = p_payment_id;
  IF v_pay_user IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_pay_user <> p_user_id THEN RAISE EXCEPTION 'Payment does not belong to that user'; END IF;
  INSERT INTO public.fpc_codes (user_id, payment_id, code) VALUES (p_user_id, p_payment_id, p_code) RETURNING id INTO v_id;
  PERFORM public.log_admin_action('create_fpc_code', 'fpc_codes', v_id::text, jsonb_build_object('user_id', p_user_id, 'payment_id', p_payment_id));
  RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_upsert_ad(p_id uuid, p_title text, p_reward numeric, p_video_url text, p_daily_limit integer, p_active boolean)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_reward < 0 THEN RAISE EXCEPTION 'Reward must be >= 0'; END IF;
  IF p_daily_limit <= 0 THEN RAISE EXCEPTION 'Daily limit must be > 0'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.ads(title, reward, video_url, daily_limit, active) VALUES (p_title, p_reward, p_video_url, p_daily_limit, p_active) RETURNING id INTO v_id;
    PERFORM public.log_admin_action('create_ad', 'ads', v_id::text, jsonb_build_object('title', p_title, 'active', p_active));
  ELSE
    UPDATE public.ads SET title=p_title, reward=p_reward, video_url=p_video_url, daily_limit=p_daily_limit, active=p_active WHERE id=p_id;
    v_id := p_id;
    PERFORM public.log_admin_action('update_ad', 'ads', v_id::text, jsonb_build_object('title', p_title, 'active', p_active));
  END IF;
  RETURN v_id;
END; $function$;

CREATE OR REPLACE FUNCTION public.admin_delete_ad(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.ads WHERE id = p_id;
  PERFORM public.log_admin_action('delete_ad', 'ads', p_id::text, NULL);
END; $function$;

-- Policies now reference the single administrator role only.
DROP POLICY IF EXISTS "Admins view audit" ON public.payment_account_audit;
CREATE POLICY "Admins view audit" ON public.payment_account_audit
  FOR SELECT TO authenticated USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "View active payment accounts" ON public.payment_accounts;
CREATE POLICY "View active payment accounts" ON public.payment_accounts
  FOR SELECT TO authenticated USING ((status = true) OR public.is_current_user_admin());
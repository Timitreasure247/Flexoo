-- Add super_admin to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Transactions
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  amount numeric NOT NULL,
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own transactions" ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_current_user_admin());
CREATE INDEX idx_transactions_user ON public.transactions(user_id, created_at DESC);

-- Referrals
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_user_id uuid NOT NULL UNIQUE,
  referee_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward_amount numeric NOT NULL DEFAULT 5000,
  status text NOT NULL DEFAULT 'successful',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own referrals" ON public.referrals
  FOR SELECT TO authenticated USING (
    public.is_current_user_admin() OR
    referrer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );
CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_profile_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.process_referral(referrer_code text, new_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_referrer_profile_id uuid;
  v_referrer_user_id uuid;
  v_referee_profile_id uuid;
  v_referral_id uuid;
  v_reward numeric := 5000;
BEGIN
  IF referrer_code IS NULL OR length(trim(referrer_code)) = 0 OR new_user_id IS NULL THEN RETURN; END IF;
  SELECT id, user_id INTO v_referrer_profile_id, v_referrer_user_id
    FROM public.profiles WHERE referral_code = upper(trim(referrer_code));
  IF v_referrer_profile_id IS NULL THEN RETURN; END IF;
  IF v_referrer_user_id = new_user_id THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_user_id = new_user_id) THEN RETURN; END IF;
  SELECT id INTO v_referee_profile_id FROM public.profiles WHERE user_id = new_user_id;
  IF v_referee_profile_id IS NULL THEN RETURN; END IF;
  UPDATE public.profiles SET referred_by = v_referrer_profile_id WHERE user_id = new_user_id AND referred_by IS NULL;
  UPDATE public.profiles SET bonus_balance = bonus_balance + v_reward WHERE id = v_referrer_profile_id;
  INSERT INTO public.referrals (referrer_profile_id, referee_user_id, referee_profile_id, reward_amount, status)
    VALUES (v_referrer_profile_id, new_user_id, v_referee_profile_id, v_reward, 'successful')
    RETURNING id INTO v_referral_id;
  INSERT INTO public.transactions (user_id, type, amount, description, metadata)
    VALUES (v_referrer_user_id, 'referral_reward', v_reward,
      'Referral bonus for inviting a new user.',
      jsonb_build_object('referral_id', v_referral_id, 'referee_user_id', new_user_id,
        'referee_profile_id', v_referee_profile_id, 'referrer_code', upper(trim(referrer_code))));
END; $$;
REVOKE EXECUTE ON FUNCTION public.process_referral(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_referral(text, uuid) TO authenticated, service_role;

-- Super admin helper (also treats admin as super_admin for unified perms)
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin','super_admin'));
$$;
GRANT EXECUTE ON FUNCTION public.is_current_user_super_admin() TO authenticated, service_role;

-- Payment accounts
CREATE TABLE public.payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  payment_method text NOT NULL DEFAULT 'Bank Transfer',
  qr_code text,
  is_default boolean NOT NULL DEFAULT false,
  status boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_accounts TO anon, authenticated;
GRANT ALL ON public.payment_accounts TO service_role;
ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View active payment accounts" ON public.payment_accounts FOR SELECT TO authenticated
  USING (status = true OR public.is_current_user_admin() OR public.is_current_user_super_admin());
CREATE TRIGGER trg_payment_accounts_updated
  BEFORE UPDATE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.payment_account_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_account_id uuid,
  admin_id uuid NOT NULL,
  admin_name text,
  action text NOT NULL,
  previous_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_account_audit TO authenticated;
GRANT ALL ON public.payment_account_audit TO service_role;
ALTER TABLE public.payment_account_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit" ON public.payment_account_audit FOR SELECT TO authenticated
  USING (public.is_current_user_admin() OR public.is_current_user_super_admin());

CREATE OR REPLACE FUNCTION public.get_admin_display_name(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(full_name, username, _uid::text) FROM public.profiles WHERE user_id = _uid;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_payment_account(
  p_bank_name text, p_account_name text, p_account_number text,
  p_payment_method text, p_qr_code text, p_is_default boolean, p_status boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_admin uuid := auth.uid();
BEGIN
  IF NOT public.is_current_user_super_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_is_default THEN UPDATE public.payment_accounts SET is_default = false WHERE is_default = true; END IF;
  INSERT INTO public.payment_accounts (bank_name, account_name, account_number, payment_method, qr_code, is_default, status)
    VALUES (p_bank_name, p_account_name, p_account_number, p_payment_method, NULLIF(p_qr_code,''), p_is_default, p_status)
    RETURNING id INTO v_id;
  INSERT INTO public.payment_account_audit (payment_account_id, admin_id, admin_name, action, new_values)
    VALUES (v_id, v_admin, public.get_admin_display_name(v_admin), 'create',
      jsonb_build_object('bank_name',p_bank_name,'account_name',p_account_name,'account_number',p_account_number,
        'payment_method',p_payment_method,'qr_code',p_qr_code,'is_default',p_is_default,'status',p_status));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_payment_account(
  p_id uuid, p_bank_name text, p_account_name text, p_account_number text,
  p_payment_method text, p_qr_code text, p_is_default boolean, p_status boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid(); v_old RECORD;
BEGIN
  IF NOT public.is_current_user_super_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
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
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_payment_account(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid(); v_old RECORD;
BEGIN
  IF NOT public.is_current_user_super_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT * INTO v_old FROM public.payment_accounts WHERE id = p_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  DELETE FROM public.payment_accounts WHERE id = p_id;
  INSERT INTO public.payment_account_audit (payment_account_id, admin_id, admin_name, action, previous_values)
    VALUES (p_id, v_admin, public.get_admin_display_name(v_admin), 'delete', to_jsonb(v_old) - 'created_at' - 'updated_at');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_default_payment_account(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.is_current_user_super_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.payment_accounts SET is_default = false WHERE is_default = true;
  UPDATE public.payment_accounts SET is_default = true WHERE id = p_id;
  INSERT INTO public.payment_account_audit (payment_account_id, admin_id, admin_name, action, new_values)
    VALUES (p_id, v_admin, public.get_admin_display_name(v_admin), 'set_default', jsonb_build_object('is_default', true));
END; $$;

-- Community channels
CREATE TABLE public.community_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  platform text NOT NULL DEFAULT 'custom',
  url text NOT NULL,
  icon text,
  member_count text,
  status text NOT NULL DEFAULT 'active',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_channels TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_channels TO authenticated;
GRANT ALL ON public.community_channels TO service_role;
ALTER TABLE public.community_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active channels" ON public.community_channels FOR SELECT
  USING (status = 'active' OR public.is_current_user_admin());
CREATE POLICY "Admins can insert channels" ON public.community_channels FOR INSERT TO authenticated
  WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admins can update channels" ON public.community_channels FOR UPDATE TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admins can delete channels" ON public.community_channels FOR DELETE TO authenticated
  USING (public.is_current_user_admin());
CREATE TRIGGER update_community_channels_updated_at
  BEFORE UPDATE ON public.community_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 1) Withdrawal columns
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS withdrawal_code text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- 2) super_admin enum value (safe to add here; no function references it as a literal cast)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;
END $$;

-- 3) Withdrawal code generator
CREATE OR REPLACE FUNCTION public.generate_withdrawal_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE new_code text; exists_already boolean;
BEGIN
  LOOP
    new_code := 'FPC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    SELECT EXISTS(SELECT 1 FROM public.withdrawal_requests WHERE withdrawal_code = new_code) INTO exists_already;
    IF NOT exists_already THEN RETURN new_code; END IF;
  END LOOP;
END; $$;

-- 4) Updated admin_update_withdrawal (uses text comparison to avoid enum literal cast this txn)
CREATE OR REPLACE FUNCTION public.admin_update_withdrawal(withdrawal_id uuid, new_status text, admin_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req RECORD; v_code text; v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = admin_user_id AND role::text IN ('admin','super_admin')
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN RAISE EXCEPTION 'Unauthorized: admin role required'; END IF;

  SELECT * INTO req FROM public.withdrawal_requests WHERE id = withdrawal_id;
  IF req IS NULL THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;

  IF new_status = 'approved' THEN
    v_code := public.generate_withdrawal_code();
    UPDATE public.withdrawal_requests
    SET status = 'approved', withdrawal_code = v_code,
        approved_at = now(), reviewed_at = now()
    WHERE id = withdrawal_id;
  ELSIF new_status = 'rejected' THEN
    UPDATE public.withdrawal_requests SET status = 'rejected', reviewed_at = now() WHERE id = withdrawal_id;
    UPDATE public.profiles SET bonus_balance = bonus_balance + req.amount WHERE user_id = req.user_id;
  ELSE
    RAISE EXCEPTION 'Invalid status';
  END IF;
END; $$;

-- 5) Realtime on withdrawal_requests
ALTER TABLE public.withdrawal_requests REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='withdrawal_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests';
  END IF;
END $$;

-- 6) is_current_user_super_admin (text comparison, safe this txn)
CREATE OR REPLACE FUNCTION public.is_current_user_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'super_admin');
$$;

-- 7) payment_accounts
CREATE TABLE IF NOT EXISTS public.payment_accounts (
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

CREATE POLICY "View active payment accounts"
  ON public.payment_accounts FOR SELECT
  USING (
    status = true
    OR public.is_current_user_admin()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'super_admin')
  );

CREATE TRIGGER trg_payment_accounts_updated
BEFORE UPDATE ON public.payment_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) payment_account_audit
CREATE TABLE IF NOT EXISTS public.payment_account_audit (
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

CREATE POLICY "Admins view audit"
  ON public.payment_account_audit FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_admin()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'super_admin')
  );

-- 9) helpers + CRUD RPCs (super_admin only)
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
  IF NOT public.is_current_user_super_admin() THEN RAISE EXCEPTION 'Unauthorized: super_admin required'; END IF;
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
  IF NOT public.is_current_user_super_admin() THEN RAISE EXCEPTION 'Unauthorized: super_admin required'; END IF;
  SELECT * INTO v_old FROM public.payment_accounts WHERE id = p_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF p_is_default AND NOT v_old.is_default THEN
    UPDATE public.payment_accounts SET is_default = false WHERE is_default = true;
  END IF;
  UPDATE public.payment_accounts
  SET bank_name = p_bank_name, account_name = p_account_name, account_number = p_account_number,
      payment_method = p_payment_method, qr_code = NULLIF(p_qr_code, ''),
      is_default = p_is_default, status = p_status
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
  IF NOT public.is_current_user_super_admin() THEN RAISE EXCEPTION 'Unauthorized: super_admin required'; END IF;
  SELECT * INTO v_old FROM public.payment_accounts WHERE id = p_id;
  IF v_old IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  DELETE FROM public.payment_accounts WHERE id = p_id;
  INSERT INTO public.payment_account_audit (payment_account_id, admin_id, admin_name, action, previous_values)
  VALUES (p_id, v_admin, public.get_admin_display_name(v_admin), 'delete',
    to_jsonb(v_old) - 'created_at' - 'updated_at');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_default_payment_account(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.is_current_user_super_admin() THEN RAISE EXCEPTION 'Unauthorized: super_admin required'; END IF;
  UPDATE public.payment_accounts SET is_default = false WHERE is_default = true;
  UPDATE public.payment_accounts SET is_default = true WHERE id = p_id;
  INSERT INTO public.payment_account_audit (payment_account_id, admin_id, admin_name, action, new_values)
  VALUES (p_id, v_admin, public.get_admin_display_name(v_admin), 'set_default', jsonb_build_object('is_default', true));
END; $$;

-- Helper: current user admin check
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role);
$$;

-- Update payment (amount/status/receipt_url)
CREATE OR REPLACE FUNCTION public.admin_update_payment(
  p_id uuid,
  p_amount numeric,
  p_status text,
  p_receipt_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  IF p_status NOT IN ('pending','confirmed','rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  UPDATE public.payments
  SET amount = p_amount,
      status = p_status,
      receipt_url = NULLIF(p_receipt_url, ''),
      reviewed_at = CASE WHEN p_status <> 'pending' THEN now() ELSE reviewed_at END
  WHERE id = p_id;
END;
$$;

-- Update payment status only (approve/reject quick action)
CREATE OR REPLACE FUNCTION public.admin_update_payment_status(
  p_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  IF p_status NOT IN ('pending','confirmed','rejected') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.payments
  SET status = p_status,
      reviewed_at = now()
  WHERE id = p_id;
END;
$$;

-- Update user profile (balance + level)
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  p_profile_id uuid,
  p_balance numeric,
  p_level text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  IF p_balance IS NULL OR p_balance < 0 THEN
    RAISE EXCEPTION 'Invalid balance';
  END IF;
  IF p_level NOT IN ('bronze','silver','gold') THEN
    RAISE EXCEPTION 'Invalid level';
  END IF;

  UPDATE public.profiles
  SET bonus_balance = p_balance,
      level = p_level
  WHERE id = p_profile_id;
END;
$$;

-- Update withdrawal account details
CREATE OR REPLACE FUNCTION public.admin_update_withdrawal_account(
  p_id uuid,
  p_bank text,
  p_account_number text,
  p_account_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  UPDATE public.withdrawal_requests
  SET bank_name = p_bank,
      account_number = p_account_number,
      account_name = p_account_name
  WHERE id = p_id;
END;
$$;

-- FPC code: create
CREATE OR REPLACE FUNCTION public.admin_create_fpc_code(
  p_user_id uuid,
  p_payment_id uuid,
  p_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_pay_user uuid;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  IF p_code !~ '^FPC-[A-Z0-9]{6,16}$' THEN
    RAISE EXCEPTION 'Invalid code format';
  END IF;

  SELECT user_id INTO v_pay_user FROM public.payments WHERE id = p_payment_id;
  IF v_pay_user IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  IF v_pay_user <> p_user_id THEN
    RAISE EXCEPTION 'Payment does not belong to that user';
  END IF;

  INSERT INTO public.fpc_codes (user_id, payment_id, code)
  VALUES (p_user_id, p_payment_id, p_code)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- FPC code: toggle used
CREATE OR REPLACE FUNCTION public.admin_toggle_fpc_used(
  p_id uuid,
  p_used boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  UPDATE public.fpc_codes
  SET used = p_used,
      used_at = CASE WHEN p_used THEN now() ELSE NULL END,
      used_for_withdrawal_id = CASE WHEN p_used THEN used_for_withdrawal_id ELSE NULL END
  WHERE id = p_id;
END;
$$;

-- FPC code: delete
CREATE OR REPLACE FUNCTION public.admin_delete_fpc_code(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  DELETE FROM public.fpc_codes WHERE id = p_id;
END;
$$;

-- FPC code: regenerate (delete old + create new for same user/payment)
CREATE OR REPLACE FUNCTION public.admin_regenerate_fpc_code(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_payment uuid;
  v_new_code text;
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT user_id, payment_id INTO v_user, v_payment
  FROM public.fpc_codes WHERE id = p_id;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Code not found';
  END IF;

  v_new_code := public.generate_fpc_code();
  DELETE FROM public.fpc_codes WHERE id = p_id;
  INSERT INTO public.fpc_codes (user_id, payment_id, code)
  VALUES (v_user, v_payment, v_new_code);

  RETURN v_new_code;
END;
$$;

-- Lock down EXECUTE: only authenticated callers, never anon
REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_payment(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_payment_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_user_profile(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_withdrawal_account(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_fpc_code(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_toggle_fpc_used(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_fpc_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_regenerate_fpc_code(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_payment(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_payment_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_withdrawal_account(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_fpc_code(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_fpc_used(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_fpc_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_regenerate_fpc_code(uuid) TO authenticated;
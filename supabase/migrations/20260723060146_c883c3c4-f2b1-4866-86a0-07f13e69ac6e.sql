-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES public.profiles(id),
  bonus_balance NUMERIC NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'bronze',
  total_tasks_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE code TEXT; exists_already BOOLEAN;
BEGIN
  LOOP
    code := 'FLEX' || upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = code) INTO exists_already;
    IF NOT exists_already THEN RETURN code; END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, username, phone, referral_code, bonus_balance)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    public.generate_referral_code(),
    170000
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.spin_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  spun_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.spin_history TO authenticated;
GRANT ALL ON public.spin_history TO service_role;
ALTER TABLE public.spin_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own spin history" ON public.spin_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own spin" ON public.spin_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.daily_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_type TEXT NOT NULL,
  completed_at DATE NOT NULL DEFAULT CURRENT_DATE,
  points_earned NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(user_id, task_type, completed_at)
);
GRANT SELECT, INSERT ON public.daily_tasks TO authenticated;
GRANT ALL ON public.daily_tasks TO service_role;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tasks" ON public.daily_tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON public.daily_tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  bvn TEXT,
  fpc_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);
GRANT SELECT, INSERT, UPDATE ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own withdrawal" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.admin_update_withdrawal(withdrawal_id UUID, new_status TEXT, admin_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE req RECORD;
BEGIN
  IF NOT public.has_role(admin_user_id, 'admin') THEN RAISE EXCEPTION 'Unauthorized: admin role required'; END IF;
  SELECT * INTO req FROM public.withdrawal_requests WHERE id = withdrawal_id;
  IF req IS NULL THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;
  UPDATE public.withdrawal_requests SET status = new_status, reviewed_at = now() WHERE id = withdrawal_id;
  IF new_status = 'rejected' THEN UPDATE public.profiles SET bonus_balance = bonus_balance + req.amount WHERE user_id = req.user_id; END IF;
END; $$;

CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 7500,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can view all payments" ON public.payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update payments" ON public.payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can upload own receipts" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admin can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can view all daily tasks" ON public.daily_tasks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can view all spin history" ON public.spin_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can view all withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);
CREATE POLICY "Admin can update withdrawal requests" ON public.withdrawal_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.fpc_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  payment_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  used_for_withdrawal_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fpc_codes_user ON public.fpc_codes(user_id);
CREATE INDEX idx_fpc_codes_code ON public.fpc_codes(code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fpc_codes TO authenticated;
GRANT ALL ON public.fpc_codes TO service_role;
ALTER TABLE public.fpc_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own fpc codes" ON public.fpc_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can mark own fpc codes used" ON public.fpc_codes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin can view all fpc codes" ON public.fpc_codes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can insert fpc codes" ON public.fpc_codes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can update all fpc codes" ON public.fpc_codes FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete fpc codes" ON public.fpc_codes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.generate_fpc_code()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE new_code TEXT; exists_already BOOLEAN;
BEGIN
  LOOP
    new_code := 'FPC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    SELECT EXISTS(SELECT 1 FROM public.fpc_codes WHERE code = new_code) INTO exists_already;
    IF NOT exists_already THEN RETURN new_code; END IF;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_payment_confirmed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    INSERT INTO public.fpc_codes (user_id, payment_id, code)
    VALUES (NEW.user_id, NEW.id, public.generate_fpc_code())
    ON CONFLICT (payment_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_payment_confirmed AFTER UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.handle_payment_confirmed();

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'admin'::app_role); $$;

CREATE OR REPLACE FUNCTION public.admin_update_payment(p_id uuid, p_amount numeric, p_status text, p_receipt_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_status NOT IN ('pending','confirmed','rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  UPDATE public.payments SET amount=p_amount, status=p_status, receipt_url=NULLIF(p_receipt_url,''),
    reviewed_at = CASE WHEN p_status <> 'pending' THEN now() ELSE reviewed_at END WHERE id = p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_payment_status(p_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_status NOT IN ('pending','confirmed','rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  UPDATE public.payments SET status=p_status, reviewed_at=now() WHERE id = p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_user_profile(p_profile_id uuid, p_balance numeric, p_level text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_balance IS NULL OR p_balance < 0 THEN RAISE EXCEPTION 'Invalid balance'; END IF;
  IF p_level NOT IN ('bronze','silver','gold') THEN RAISE EXCEPTION 'Invalid level'; END IF;
  UPDATE public.profiles SET bonus_balance = p_balance, level = p_level WHERE id = p_profile_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_withdrawal_account(p_id uuid, p_bank text, p_account_number text, p_account_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.withdrawal_requests SET bank_name=p_bank, account_number=p_account_number, account_name=p_account_name WHERE id=p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_create_fpc_code(p_user_id uuid, p_payment_id uuid, p_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_pay_user uuid;
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_code !~ '^FPC-[A-Z0-9]{6,16}$' THEN RAISE EXCEPTION 'Invalid code format'; END IF;
  SELECT user_id INTO v_pay_user FROM public.payments WHERE id = p_payment_id;
  IF v_pay_user IS NULL THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF v_pay_user <> p_user_id THEN RAISE EXCEPTION 'Payment does not belong to that user'; END IF;
  INSERT INTO public.fpc_codes (user_id, payment_id, code) VALUES (p_user_id, p_payment_id, p_code) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_toggle_fpc_used(p_id uuid, p_used boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.fpc_codes SET used=p_used, used_at=CASE WHEN p_used THEN now() ELSE NULL END,
    used_for_withdrawal_id = CASE WHEN p_used THEN used_for_withdrawal_id ELSE NULL END WHERE id = p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_fpc_code(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.fpc_codes WHERE id = p_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_regenerate_fpc_code(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_payment uuid; v_new_code text;
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT user_id, payment_id INTO v_user, v_payment FROM public.fpc_codes WHERE id = p_id;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Code not found'; END IF;
  v_new_code := public.generate_fpc_code();
  DELETE FROM public.fpc_codes WHERE id = p_id;
  INSERT INTO public.fpc_codes (user_id, payment_id, code) VALUES (v_user, v_payment, v_new_code);
  RETURN v_new_code;
END; $$;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read settings" ON public.app_settings FOR SELECT TO authenticated USING (true);

INSERT INTO public.app_settings (key, value) VALUES
  ('whatsapp_url', 'https://wa.me/2348000000000'),
  ('telegram_url', 'https://t.me/+Mg7JaPJoFNVhMTc0'),
  ('support_email', 'support@flexoo.com'),
  ('support_phone', '+234 800 FLEXOO'),
  ('ad_video_ids', 'dQw4w9WgXcQ,9bZkp7q19f0,kJQP7kiw5Fk,RgKAFK5djSk,JGwWNGJdvx8')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_update_setting(p_key text, p_value text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.app_settings (key, value, updated_at) VALUES (p_key, p_value, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.lookup_referrer_id(p_code text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM public.profiles WHERE referral_code = p_code LIMIT 1; $$;
GRANT EXECUTE ON FUNCTION public.lookup_referrer_id(text) TO anon, authenticated;

CREATE POLICY "Users view own receipts" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role)));

CREATE OR REPLACE FUNCTION public.process_referral(referrer_code TEXT, new_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE referrer_profile_id UUID;
BEGIN
  SELECT id INTO referrer_profile_id FROM public.profiles WHERE referral_code = referrer_code;
  IF referrer_profile_id IS NOT NULL THEN
    UPDATE public.profiles SET referred_by = referrer_profile_id WHERE user_id = new_user_id;
    UPDATE public.profiles SET bonus_balance = bonus_balance + 500 WHERE id = referrer_profile_id;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.process_referral(text, uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  reward NUMERIC NOT NULL DEFAULT 200,
  video_url TEXT NOT NULL,
  daily_limit INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ads TO authenticated;
GRANT ALL ON public.ads TO service_role;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View active ads" ON public.ads FOR SELECT TO authenticated USING (active = true OR public.is_current_user_admin());
CREATE POLICY "Admin manages ads insert" ON public.ads FOR INSERT TO authenticated WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admin manages ads update" ON public.ads FOR UPDATE TO authenticated USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "Admin manages ads delete" ON public.ads FOR DELETE TO authenticated USING (public.is_current_user_admin());
CREATE TRIGGER trg_ads_updated BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.ad_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_id UUID NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
  reward NUMERIC NOT NULL DEFAULT 0,
  completed_on DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ad_completions TO authenticated;
GRANT ALL ON public.ad_completions TO service_role;
ALTER TABLE public.ad_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ad completions" ON public.ad_completions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all ad completions" ON public.ad_completions FOR SELECT TO authenticated USING (public.is_current_user_admin());
CREATE POLICY "Block direct ad completion inserts" ON public.ad_completions FOR INSERT TO authenticated WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.complete_ad(p_ad_id UUID)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ad RECORD;
  v_today DATE := (now() AT TIME ZONE 'UTC')::date;
  v_done_today INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_ad FROM public.ads WHERE id = p_ad_id AND active = true;
  IF v_ad IS NULL THEN RAISE EXCEPTION 'Ad not found or inactive'; END IF;
  SELECT COUNT(*) INTO v_done_today FROM public.ad_completions
    WHERE user_id = v_uid AND ad_id = p_ad_id AND completed_on = v_today;
  IF v_done_today >= v_ad.daily_limit THEN RAISE EXCEPTION 'Daily limit reached for this ad'; END IF;
  INSERT INTO public.ad_completions (user_id, ad_id, reward, completed_on) VALUES (v_uid, p_ad_id, v_ad.reward, v_today);
  UPDATE public.profiles SET bonus_balance = bonus_balance + v_ad.reward WHERE user_id = v_uid;
  INSERT INTO public.transactions (user_id, type, amount, description, metadata)
    VALUES (v_uid, 'ad_reward', v_ad.reward, 'Watched ad: ' || v_ad.title, jsonb_build_object('ad_id', p_ad_id));
  RETURN jsonb_build_object('reward', v_ad.reward, 'title', v_ad.title);
END; $$;
GRANT EXECUTE ON FUNCTION public.complete_ad(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_referral_stats(p_user_id UUID DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := COALESCE(p_user_id, auth.uid());
  v_profile_id UUID;
  v_successful INT;
  v_pending INT;
  v_earnings NUMERIC;
  v_goal INT;
  v_has_free BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid;
  SELECT COALESCE(COUNT(*) FILTER (WHERE status = 'successful'), 0),
         COALESCE(COUNT(*) FILTER (WHERE status = 'pending'), 0),
         COALESCE(SUM(reward_amount) FILTER (WHERE status = 'successful'), 0)
    INTO v_successful, v_pending, v_earnings
    FROM public.referrals WHERE referrer_profile_id = v_profile_id;
  SELECT COALESCE(NULLIF(value,'')::int, 50) INTO v_goal FROM public.app_settings WHERE key = 'referral_goal';
  SELECT EXISTS(SELECT 1 FROM public.fpc_codes WHERE user_id = v_uid AND payment_id IN (
    SELECT id FROM public.payments WHERE user_id = v_uid AND amount = 0
  )) INTO v_has_free;
  RETURN jsonb_build_object('successful', v_successful, 'pending', v_pending, 'earnings', v_earnings, 'goal', v_goal, 'has_free_code', v_has_free);
END; $$;
GRANT EXECUTE ON FUNCTION public.get_referral_stats(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_free_withdrawal_code()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile_id UUID;
  v_successful INT;
  v_goal INT;
  v_enabled TEXT;
  v_payment_id UUID;
  v_code TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT value INTO v_enabled FROM public.app_settings WHERE key = 'free_code_enabled';
  IF COALESCE(v_enabled,'true') <> 'true' THEN RAISE EXCEPTION 'Free code feature is disabled'; END IF;
  SELECT COALESCE(NULLIF(value,'')::int, 50) INTO v_goal FROM public.app_settings WHERE key = 'referral_goal';
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid;
  SELECT COUNT(*) INTO v_successful FROM public.referrals WHERE referrer_profile_id = v_profile_id AND status = 'successful';
  IF v_successful < v_goal THEN RAISE EXCEPTION 'You need % successful referrals (you have %)', v_goal, v_successful; END IF;
  IF EXISTS (SELECT 1 FROM public.payments p JOIN public.fpc_codes f ON f.payment_id = p.id WHERE p.user_id = v_uid AND p.amount = 0) THEN
    RAISE EXCEPTION 'You already claimed your free withdrawal code';
  END IF;
  INSERT INTO public.payments (user_id, amount, status, reviewed_at) VALUES (v_uid, 0, 'confirmed', now()) RETURNING id INTO v_payment_id;
  SELECT code INTO v_code FROM public.fpc_codes WHERE payment_id = v_payment_id;
  RETURN jsonb_build_object('code', v_code);
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_free_withdrawal_code() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_ad(p_id UUID, p_title TEXT, p_reward NUMERIC, p_video_url TEXT, p_daily_limit INT, p_active BOOLEAN)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID;
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_reward < 0 THEN RAISE EXCEPTION 'Reward must be >= 0'; END IF;
  IF p_daily_limit <= 0 THEN RAISE EXCEPTION 'Daily limit must be > 0'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.ads(title, reward, video_url, daily_limit, active) VALUES (p_title, p_reward, p_video_url, p_daily_limit, p_active) RETURNING id INTO v_id;
  ELSE
    UPDATE public.ads SET title=p_title, reward=p_reward, video_url=p_video_url, daily_limit=p_daily_limit, active=p_active WHERE id=p_id;
    v_id := p_id;
  END IF;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_ad(UUID,TEXT,NUMERIC,TEXT,INT,BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_ad(p_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.ads WHERE id = p_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_delete_ad(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reset_user_referrals(p_profile_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.referrals WHERE referrer_profile_id = p_profile_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_referrals(UUID) TO authenticated;

ALTER TABLE public.ads REPLICA IDENTITY FULL;
ALTER TABLE public.ad_completions REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ads; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_completions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

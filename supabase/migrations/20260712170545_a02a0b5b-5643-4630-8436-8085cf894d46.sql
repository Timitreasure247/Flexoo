
-- Transactions table
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

-- Referrals table
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

-- Rewrite process_referral: ₦5,000 to referrer, transaction log, abuse prevention
CREATE OR REPLACE FUNCTION public.process_referral(referrer_code text, new_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_profile_id uuid;
  v_referrer_user_id uuid;
  v_referee_profile_id uuid;
  v_reward numeric := 5000;
BEGIN
  IF referrer_code IS NULL OR length(trim(referrer_code)) = 0 OR new_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Look up referrer
  SELECT id, user_id INTO v_referrer_profile_id, v_referrer_user_id
  FROM public.profiles WHERE referral_code = upper(trim(referrer_code));
  IF v_referrer_profile_id IS NULL THEN
    RETURN; -- invalid code
  END IF;

  -- No self-referral
  IF v_referrer_user_id = new_user_id THEN
    RETURN;
  END IF;

  -- Duplicate reward guard
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_user_id = new_user_id) THEN
    RETURN;
  END IF;

  -- Get referee profile
  SELECT id INTO v_referee_profile_id FROM public.profiles WHERE user_id = new_user_id;
  IF v_referee_profile_id IS NULL THEN
    RETURN;
  END IF;

  -- Save relationship (first registration only)
  UPDATE public.profiles
  SET referred_by = v_referrer_profile_id
  WHERE user_id = new_user_id AND referred_by IS NULL;

  -- Credit referrer wallet
  UPDATE public.profiles
  SET bonus_balance = bonus_balance + v_reward
  WHERE id = v_referrer_profile_id;

  -- Record referral
  INSERT INTO public.referrals (referrer_profile_id, referee_user_id, referee_profile_id, reward_amount, status)
  VALUES (v_referrer_profile_id, new_user_id, v_referee_profile_id, v_reward, 'successful');

  -- Transaction record for referrer
  INSERT INTO public.transactions (user_id, type, amount, description, metadata)
  VALUES (v_referrer_user_id, 'referral_reward', v_reward,
    'Referral bonus for inviting a new user.',
    jsonb_build_object('referee_user_id', new_user_id, 'referrer_code', upper(trim(referrer_code))));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_referral(text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.process_referral(text, uuid) TO authenticated, service_role;

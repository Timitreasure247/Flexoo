
-- Enable realtime on profiles and transactions
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Update process_referral to link transaction back to the specific referral record
CREATE OR REPLACE FUNCTION public.process_referral(referrer_code text, new_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_referrer_profile_id uuid;
  v_referrer_user_id uuid;
  v_referee_profile_id uuid;
  v_referral_id uuid;
  v_reward numeric := 5000;
BEGIN
  IF referrer_code IS NULL OR length(trim(referrer_code)) = 0 OR new_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id, user_id INTO v_referrer_profile_id, v_referrer_user_id
  FROM public.profiles WHERE referral_code = upper(trim(referrer_code));
  IF v_referrer_profile_id IS NULL THEN RETURN; END IF;

  IF v_referrer_user_id = new_user_id THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_user_id = new_user_id) THEN
    RETURN;
  END IF;

  SELECT id INTO v_referee_profile_id FROM public.profiles WHERE user_id = new_user_id;
  IF v_referee_profile_id IS NULL THEN RETURN; END IF;

  UPDATE public.profiles
  SET referred_by = v_referrer_profile_id
  WHERE user_id = new_user_id AND referred_by IS NULL;

  UPDATE public.profiles
  SET bonus_balance = bonus_balance + v_reward
  WHERE id = v_referrer_profile_id;

  INSERT INTO public.referrals (referrer_profile_id, referee_user_id, referee_profile_id, reward_amount, status)
  VALUES (v_referrer_profile_id, new_user_id, v_referee_profile_id, v_reward, 'successful')
  RETURNING id INTO v_referral_id;

  INSERT INTO public.transactions (user_id, type, amount, description, metadata)
  VALUES (v_referrer_user_id, 'referral_reward', v_reward,
    'Referral bonus for inviting a new user.',
    jsonb_build_object(
      'referral_id', v_referral_id,
      'referee_user_id', new_user_id,
      'referee_profile_id', v_referee_profile_id,
      'referrer_code', upper(trim(referrer_code))
    ));
END;
$function$;


-- 1) Rewrite process_referral to credit the reward immediately upon signup.
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
  v_referee_name text;
  v_reward numeric;
BEGIN
  IF referrer_code IS NULL OR length(trim(referrer_code)) = 0 OR new_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id, user_id INTO v_referrer_profile_id, v_referrer_user_id
    FROM public.profiles WHERE referral_code = upper(trim(referrer_code));
  IF v_referrer_profile_id IS NULL THEN RETURN; END IF;
  IF v_referrer_user_id = new_user_id THEN RETURN; END IF;

  -- One reward per referee: bail if already recorded.
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_user_id = new_user_id) THEN
    RETURN;
  END IF;

  SELECT id INTO v_referee_profile_id FROM public.profiles WHERE user_id = new_user_id;
  IF v_referee_profile_id IS NULL THEN RETURN; END IF;

  -- Serialize concurrent processing per referrer
  PERFORM pg_advisory_xact_lock(hashtext('ref-reward:' || new_user_id::text));

  -- Guard again inside the lock
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_user_id = new_user_id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(NULLIF(value,'')::numeric, 5000) INTO v_reward
    FROM public.app_settings WHERE key = 'referral_reward';
  v_reward := COALESCE(v_reward, 5000);

  UPDATE public.profiles SET referred_by = v_referrer_profile_id
    WHERE user_id = new_user_id AND referred_by IS NULL;

  SELECT COALESCE(NULLIF(username,''), NULLIF(full_name,''), 'a new user')
    INTO v_referee_name FROM public.profiles WHERE user_id = new_user_id;

  -- Create the referral record already marked successful.
  INSERT INTO public.referrals (referrer_profile_id, referee_user_id, referee_profile_id, reward_amount, status)
    VALUES (v_referrer_profile_id, new_user_id, v_referee_profile_id, v_reward, 'successful');

  -- Credit the referrer's wallet balance immediately.
  UPDATE public.profiles
    SET bonus_balance = bonus_balance + v_reward,
        updated_at = now()
    WHERE id = v_referrer_profile_id;

  -- Log the reward transaction so it shows in Transaction History right away.
  IF v_referrer_user_id IS NOT NULL THEN
    INSERT INTO public.transactions (user_id, type, amount, description, metadata)
    VALUES (
      v_referrer_user_id,
      'referral_reward',
      v_reward,
      'Referral reward for inviting @' || v_referee_name,
      jsonb_build_object(
        'referee_user_id', new_user_id,
        'referee_profile_id', v_referee_profile_id,
        'source', 'process_referral'
      )
    );
  END IF;
END;
$function$;

-- 2) Remove referral crediting from payment confirmation (still issues withdrawal code).
CREATE OR REPLACE FUNCTION public.handle_payment_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    INSERT INTO public.fpc_codes (user_id, payment_id, code)
    VALUES (NEW.user_id, NEW.id, public.generate_fpc_code())
    ON CONFLICT (payment_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

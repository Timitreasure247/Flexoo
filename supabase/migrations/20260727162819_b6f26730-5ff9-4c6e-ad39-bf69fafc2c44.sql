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
  v_ref_code text;
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

  -- Record referral (pending) if signup metadata carried a referral code
  -- and one is not already recorded for this user. Reward happens later,
  -- when the user's payment is confirmed (handle_payment_confirmed).
  v_ref_code := NULLIF(trim(COALESCE(auth.jwt() -> 'user_metadata' ->> 'referral_code', '')), '');
  IF v_ref_code IS NOT NULL THEN
    BEGIN
      PERFORM public.process_referral(v_ref_code, v_uid);
    EXCEPTION WHEN OTHERS THEN
      -- Never let a referral failure block the bonus.
      RAISE NOTICE 'process_referral failed: %', SQLERRM;
    END;
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
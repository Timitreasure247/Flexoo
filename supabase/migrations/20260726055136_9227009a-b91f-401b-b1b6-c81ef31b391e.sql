
-- 1. Realtime publication
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;
ALTER TABLE public.withdrawal_requests REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.referrals REPLICA IDENTITY FULL;
ALTER TABLE public.fpc_codes REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.payments; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.fpc_codes; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 2. Change process_referral: only record as pending on signup, no reward yet.
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
BEGIN
  IF referrer_code IS NULL OR length(trim(referrer_code)) = 0 OR new_user_id IS NULL THEN RETURN; END IF;
  SELECT id, user_id INTO v_referrer_profile_id, v_referrer_user_id FROM public.profiles WHERE referral_code = upper(trim(referrer_code));
  IF v_referrer_profile_id IS NULL THEN RETURN; END IF;
  IF v_referrer_user_id = new_user_id THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_user_id = new_user_id) THEN RETURN; END IF;
  SELECT id INTO v_referee_profile_id FROM public.profiles WHERE user_id = new_user_id;
  IF v_referee_profile_id IS NULL THEN RETURN; END IF;

  UPDATE public.profiles SET referred_by = v_referrer_profile_id WHERE user_id = new_user_id AND referred_by IS NULL;

  INSERT INTO public.referrals (referrer_profile_id, referee_user_id, referee_profile_id, reward_amount, status)
    VALUES (v_referrer_profile_id, new_user_id, v_referee_profile_id, 5000, 'pending');
END;
$function$;

-- 3. Uniqueness guarantee: only one successful referral row per referee
CREATE UNIQUE INDEX IF NOT EXISTS referrals_one_success_per_referee
  ON public.referrals (referee_user_id)
  WHERE status = 'successful';

-- 4. Extend handle_payment_confirmed to also reward referrer once, atomically.
CREATE OR REPLACE FUNCTION public.handle_payment_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_referral RECORD;
  v_reward numeric;
  v_referrer_user_id uuid;
  v_referee_name text;
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    -- Issue withdrawal code (unchanged)
    INSERT INTO public.fpc_codes (user_id, payment_id, code)
    VALUES (NEW.user_id, NEW.id, public.generate_fpc_code())
    ON CONFLICT (payment_id) DO NOTHING;

    -- Referral reward — only for paid activation (amount > 0), only once per referee
    IF COALESCE(NEW.amount, 0) > 0 THEN
      PERFORM pg_advisory_xact_lock(hashtext('ref-reward:' || NEW.user_id::text));

      SELECT r.* INTO v_referral
      FROM public.referrals r
      WHERE r.referee_user_id = NEW.user_id
        AND r.status = 'pending'
      LIMIT 1;

      IF v_referral.id IS NOT NULL THEN
        SELECT COALESCE(NULLIF(value,'')::numeric, 5000)
          INTO v_reward
          FROM public.app_settings WHERE key = 'referral_reward';
        v_reward := COALESCE(v_reward, 5000);

        SELECT user_id INTO v_referrer_user_id FROM public.profiles WHERE id = v_referral.referrer_profile_id;
        SELECT COALESCE(NULLIF(full_name,''), username, 'a new user')
          INTO v_referee_name FROM public.profiles WHERE user_id = NEW.user_id;

        UPDATE public.referrals
          SET status = 'successful', reward_amount = v_reward
          WHERE id = v_referral.id;

        UPDATE public.profiles
          SET bonus_balance = bonus_balance + v_reward
          WHERE id = v_referral.referrer_profile_id;

        IF v_referrer_user_id IS NOT NULL THEN
          INSERT INTO public.transactions (user_id, type, amount, description, metadata)
          VALUES (
            v_referrer_user_id,
            'referral_reward',
            v_reward,
            'Referral reward for inviting ' || v_referee_name,
            jsonb_build_object(
              'referral_id', v_referral.id,
              'referee_user_id', NEW.user_id,
              'payment_id', NEW.id
            )
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists (in case only the function was previously created)
DROP TRIGGER IF EXISTS trg_handle_payment_confirmed ON public.payments;
CREATE TRIGGER trg_handle_payment_confirmed
AFTER UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.handle_payment_confirmed();

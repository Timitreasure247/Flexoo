
-- Add rejection reason to withdrawal_requests
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Enable realtime for withdrawal_requests
ALTER TABLE public.withdrawal_requests REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Update admin_update_withdrawal to accept optional rejection reason
CREATE OR REPLACE FUNCTION public.admin_update_withdrawal(withdrawal_id uuid, new_status text, admin_user_id uuid, reason text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE req RECORD; v_code text;
BEGIN
  IF NOT public.has_role(admin_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  SELECT * INTO req FROM public.withdrawal_requests WHERE id = withdrawal_id;
  IF req IS NULL THEN RAISE EXCEPTION 'Withdrawal request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request already processed'; END IF;
  IF new_status = 'approved' THEN
    v_code := 'FPC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    UPDATE public.withdrawal_requests SET status='approved', withdrawal_code=v_code, approved_at=now(), reviewed_at=now(), rejection_reason=NULL WHERE id = withdrawal_id;
  ELSIF new_status = 'rejected' THEN
    UPDATE public.withdrawal_requests SET status='rejected', reviewed_at=now(), rejection_reason=NULLIF(trim(coalesce(reason,'')),'') WHERE id = withdrawal_id;
    UPDATE public.profiles SET bonus_balance = bonus_balance + req.amount WHERE user_id = req.user_id;
  ELSE RAISE EXCEPTION 'Invalid status'; END IF;
END; $function$;

-- Seed dynamic payment settings
INSERT INTO public.app_settings (key, value) VALUES
  ('withdrawal_code_price', '7500'),
  ('pay_with_transfer_link', '')
ON CONFLICT (key) DO NOTHING;

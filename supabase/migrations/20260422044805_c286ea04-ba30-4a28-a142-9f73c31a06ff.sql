
-- 1) FPC codes table
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

ALTER TABLE public.fpc_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fpc codes"
ON public.fpc_codes FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own fpc codes"
ON public.fpc_codes FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all fpc codes"
ON public.fpc_codes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update all fpc codes"
ON public.fpc_codes FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2) Code generator
CREATE OR REPLACE FUNCTION public.generate_fpc_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    new_code := 'FPC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    SELECT EXISTS(SELECT 1 FROM public.fpc_codes WHERE code = new_code) INTO exists_already;
    IF NOT exists_already THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;

-- 3) Trigger: on payment confirmed, auto-create FPC code
CREATE OR REPLACE FUNCTION public.handle_payment_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    INSERT INTO public.fpc_codes (user_id, payment_id, code)
    VALUES (NEW.user_id, NEW.id, public.generate_fpc_code())
    ON CONFLICT (payment_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_confirmed
AFTER UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_confirmed();

-- 4) Withdrawal requests: add fpc_code column, make bvn nullable
ALTER TABLE public.withdrawal_requests
  ADD COLUMN fpc_code TEXT;

ALTER TABLE public.withdrawal_requests
  ALTER COLUMN bvn DROP NOT NULL;

-- 5) Backfill: generate FPC codes for already-confirmed payments without one
INSERT INTO public.fpc_codes (user_id, payment_id, code)
SELECT p.user_id, p.id, public.generate_fpc_code()
FROM public.payments p
LEFT JOIN public.fpc_codes f ON f.payment_id = p.id
WHERE p.status = 'confirmed' AND f.id IS NULL;

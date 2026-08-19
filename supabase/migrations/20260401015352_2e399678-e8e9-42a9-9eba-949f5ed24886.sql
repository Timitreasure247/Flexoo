-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Update admin_update_withdrawal to verify admin role
CREATE OR REPLACE FUNCTION public.admin_update_withdrawal(withdrawal_id UUID, new_status TEXT, admin_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req RECORD;
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(admin_user_id, 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  SELECT * INTO req FROM public.withdrawal_requests WHERE id = withdrawal_id;
  
  IF req IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;
  
  IF req.status != 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  UPDATE public.withdrawal_requests 
  SET status = new_status, reviewed_at = now() 
  WHERE id = withdrawal_id;

  IF new_status = 'rejected' THEN
    UPDATE public.profiles 
    SET bonus_balance = bonus_balance + req.amount 
    WHERE user_id = req.user_id;
  END IF;
END;
$$;
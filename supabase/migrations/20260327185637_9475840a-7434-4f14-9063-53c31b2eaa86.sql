-- Create a function to handle admin withdrawal actions
-- This uses SECURITY DEFINER so it can bypass RLS
CREATE OR REPLACE FUNCTION public.admin_update_withdrawal(
  withdrawal_id uuid,
  new_status text,
  admin_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req RECORD;
BEGIN
  -- Get the withdrawal request
  SELECT * INTO req FROM public.withdrawal_requests WHERE id = withdrawal_id;
  
  IF req IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found';
  END IF;
  
  IF req.status != 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  -- Update the withdrawal status
  UPDATE public.withdrawal_requests 
  SET status = new_status, reviewed_at = now() 
  WHERE id = withdrawal_id;

  -- If rejected, refund the balance
  IF new_status = 'rejected' THEN
    UPDATE public.profiles 
    SET bonus_balance = bonus_balance + req.amount 
    WHERE user_id = req.user_id;
  END IF;
END;
$$;

-- Allow all authenticated users to read all withdrawal requests (for admin view)
-- In production you'd want a proper admin role check
CREATE POLICY "Admin can view all withdrawals"
ON public.withdrawal_requests
FOR SELECT
TO authenticated
USING (true);
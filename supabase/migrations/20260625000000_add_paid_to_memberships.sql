-- Add paid column to memberships to track payment status per plan duration
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;

-- Secure RPC for members to confirm their own UPI payment
-- Runs as SECURITY DEFINER so it can update both payments and memberships
CREATE OR REPLACE FUNCTION public.confirm_payment(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment record;
  v_membership_id uuid;
BEGIN
  -- Fetch payment and verify ownership
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found or does not belong to you';
  END IF;

  IF v_payment.status = 'paid' THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Already paid');
  END IF;

  -- Update payment status
  UPDATE public.payments
  SET status = 'paid', paid_at = now()
  WHERE id = p_id;

  -- Mark linked membership as paid
  IF v_payment.membership_id IS NOT NULL THEN
    UPDATE public.memberships
    SET paid = true
    WHERE id = v_payment.membership_id;
  END IF;

  -- Notify admin
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    NULL,
    'UPI payment confirmed',
    (SELECT full_name FROM public.profiles WHERE id = auth.uid()) || ' confirmed UPI payment.',
    'info'
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_payment TO authenticated;

-- Backfill: mark memberships as paid if they have a linked paid payment
UPDATE public.memberships m
SET paid = true
WHERE EXISTS (
  SELECT 1 FROM public.payments p
  WHERE p.membership_id = m.id AND p.status = 'paid'
);

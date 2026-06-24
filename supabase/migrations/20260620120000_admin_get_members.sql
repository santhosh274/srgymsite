-- SECURITY DEFINER function for admin panel to list all members
-- Bypasses RLS so it works regardless of auth session state
CREATE OR REPLACE FUNCTION public.admin_get_members()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can view all members';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'phone', p.phone,
      'joined_at', p.joined_at,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'memberships', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', m.id,
            'start_date', m.start_date,
            'end_date', m.end_date,
            'status', m.status,
            'plan_id', m.plan_id,
            'paid', m.paid,
            'membership_plans', jsonb_build_object('name', mp.name, 'price', mp.price)
          )
          ORDER BY m.end_date DESC
        )
        FROM public.memberships m
        LEFT JOIN public.membership_plans mp ON mp.id = m.plan_id
        WHERE m.user_id = p.id
      )
    )
    ORDER BY p.joined_at DESC
  ), '[]'::jsonb)
  FROM public.profiles p
  INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_members TO authenticated, anon;

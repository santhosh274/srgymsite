-- Admin functions for user management
CREATE OR REPLACE FUNCTION public.admin_update_user(
  p_user_id text,
  p_password text DEFAULT NULL,
  p_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can update users';
  END IF;

  UPDATE public.auth
  SET password = COALESCE(p_password, password),
      name = COALESCE(p_name, name)
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('user_id', p_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;

  v_email := lower(p_user_id) || '@srgym.local';

  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;

  DELETE FROM public.auth WHERE user_id = p_user_id;

  IF v_uid IS NOT NULL THEN
    DELETE FROM auth.identities WHERE user_id = v_uid;
    DELETE FROM auth.users WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object('deleted', p_user_id);
END;
$$;

-- Renewal check: creates notifications 2 days before plan expiry
CREATE OR REPLACE FUNCTION public.check_renewals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count int := 0;
  v_membership record;
BEGIN
  FOR v_membership IN
    SELECT m.id, m.user_id, m.end_date, m.plan_id, mp.name as plan_name,
           p.full_name
    FROM public.memberships m
    JOIN public.membership_plans mp ON mp.id = m.plan_id
    JOIN public.profiles p ON p.id = m.user_id
    WHERE m.status = 'active'
      AND m.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 days'
      AND m.end_date > CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = m.user_id
          AND n.title = 'Membership renewal'
          AND n.created_at::date = CURRENT_DATE
      )
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_membership.user_id,
      'Membership renewal',
      'Your ' || v_membership.plan_name || ' plan expires on ' || v_membership.end_date::text || '. Please renew to continue.',
      'warning'
    );

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NULL,
      'Renewal: ' || v_membership.full_name,
      v_membership.full_name || '''s ' || v_membership.plan_name || ' expires on ' || v_membership.end_date::text || '.',
      'warning'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('created', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_renewals TO authenticated, anon;

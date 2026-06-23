-- Keep email column but allow it to be NULL (email auth disabled)
ALTER TABLE public.auth ALTER COLUMN email DROP NOT NULL;


-- Rewrite admin_create_user to derive email internally
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_id_no text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  v_email := lower(p_id_no) || '@srgym.local';

  INSERT INTO public.auth (user_id, password, role)
  VALUES (p_id_no, p_password, 'member')
  ON CONFLICT (user_id) DO UPDATE
    SET password = EXCLUDED.password,
        role = 'member';

  RETURN jsonb_build_object('user_id', p_id_no);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user(text, text) TO authenticated, anon;

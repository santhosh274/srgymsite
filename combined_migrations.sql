
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'member', 'trainer');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  address text,
  emergency_contact text,
  date_of_birth date,
  photo_url text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "admins delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto profile + member role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, address, emergency_contact)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'address',
    NEW.raw_user_meta_data->>'emergency_contact'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Membership plans
CREATE TABLE public.membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  duration_months int NOT NULL,
  price numeric(10,2) NOT NULL,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.membership_plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.membership_plans TO authenticated;
GRANT ALL ON public.membership_plans TO service_role;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads active plans" ON public.membership_plans FOR SELECT USING (true);
CREATE POLICY "admins manage plans" ON public.membership_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Memberships
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  frozen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own membership" ON public.memberships FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage memberships" ON public.memberships FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Payments
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  due_date date NOT NULL,
  paid_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  receipt_no text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage payments" ON public.payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Attendance
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in timestamptz NOT NULL DEFAULT now(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own attendance" ON public.attendance FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users insert own attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins manage attendance" ON public.attendance FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Leave requests
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own leaves" ON public.leave_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users create own leaves" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins manage leaves" ON public.leave_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own + broadcast notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR user_id IS NULL OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins manage notifications" ON public.notifications FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Workout & Diet plans
CREATE TABLE public.workout_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_plans TO authenticated;
GRANT ALL ON public.workout_plans TO service_role;
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own workouts" ON public.workout_plans FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage workouts" ON public.workout_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.diet_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diet_plans TO authenticated;
GRANT ALL ON public.diet_plans TO service_role;
ALTER TABLE public.diet_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own diets" ON public.diet_plans FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage diets" ON public.diet_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trainers (public showcase)
CREATE TABLE public.trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  specialty text NOT NULL,
  bio text,
  photo_url text,
  experience_years int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.trainers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.trainers TO authenticated;
GRANT ALL ON public.trainers TO service_role;
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads trainers" ON public.trainers FOR SELECT USING (true);
CREATE POLICY "admins manage trainers" ON public.trainers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Holidays
CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.holidays TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads holidays" ON public.holidays FOR SELECT USING (true);
CREATE POLICY "admins manage holidays" ON public.holidays FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Contact messages
CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can submit contact" ON public.contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "admins read contact" ON public.contact_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete contact" ON public.contact_messages FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;

DROP POLICY "anyone can submit contact" ON public.contact_messages;
CREATE POLICY "anyone can submit contact" ON public.contact_messages
  FOR INSERT WITH CHECK (
    length(trim(name)) BETWEEN 1 AND 100
    AND length(trim(email)) BETWEEN 3 AND 200
    AND length(trim(message)) BETWEEN 1 AND 2000
  );
-- Auth credentials table for userID + password login
-- Maps a human-readable user_id (e.g. "admin123", "SR1") to a Supabase Auth email
CREATE TABLE public.auth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL UNIQUE,
  password text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'member',
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth ENABLE ROW LEVEL SECURITY;

-- Allow anon to read auth table during login (only returns email for matching user_id)
CREATE POLICY "anon can read auth by user_id" ON public.auth FOR SELECT TO anon USING (true);
CREATE POLICY "authenticated can read own auth" ON public.auth FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.auth TO anon, authenticated;
GRANT ALL ON public.auth TO service_role;
-- Grant EXECUTE on has_role to anon and authenticated roles
-- This function is used in RLS policies across all tables (user_roles, profiles, payments, leaves, etc.)
-- Without this grant, any query hitting an RLS policy referencing has_role would fail with
-- "permission denied for function has_role"
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated, anon;
-- Function called AFTER signUp creates the Auth user, to:
-- 1. Verify the caller is an admin
-- 2. Insert the auth table mapping (ID No → email)
-- 3. Return confirmation
-- The handle_new_user trigger handles profile and user_roles creation.
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_id_no text,
  p_password text,
  p_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Verify caller is an admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Create auth table mapping (ID No → email for custom login)
  INSERT INTO public.auth (user_id, password, role, email)
  VALUES (p_id_no, p_password, 'member', p_email)
  ON CONFLICT (user_id) DO UPDATE
    SET password = EXCLUDED.password,
        email = EXCLUDED.email,
        role = 'member';

  RETURN jsonb_build_object('user_id', p_id_no, 'email', p_email);
END;
$$;

-- Grant execute to authenticated users (admin check is internal)
GRANT EXECUTE ON FUNCTION public.admin_create_user TO authenticated, anon;
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
-- Auto-create/update auth.users entries when public.auth is modified
-- so that editing the auth table directly in the dashboard works for login.
CREATE OR REPLACE FUNCTION public.sync_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_user_id uuid;
BEGIN
  v_email := lower(NEW.user_id) || '@srgym.local';

  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_sso_user, is_anonymous,
      confirmation_token, recovery_token,
      email_change_token_current, email_change_token_new,
      email_change, email_change_confirm_status
    ) VALUES (
      '00000000-0000-0000-0000-000000000000'::uuid, v_user_id,
      'authenticated', 'authenticated', v_email,
      extensions.crypt(NEW.password, extensions.gen_salt('bf', 10)),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false, false,
      '', '', '', '',
      '', 0
    );

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_user_id::text, v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', false,
        'phone_verified', false
      ),
      'email', now(), now(), now()
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(NEW.password, extensions.gen_salt('bf', 10)),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_auth_user
  AFTER INSERT OR UPDATE ON public.auth
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auth_user();
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
ALTER TABLE public.attendance ADD COLUMN check_out timestamptz;
CREATE TABLE IF NOT EXISTS public.member_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('workout', 'diet')),
  title text NOT NULL,
  content text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin all" ON public.member_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Member read own" ON public.member_plans
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT ALL ON public.member_plans TO authenticated, anon;
CREATE POLICY "users update own payments" ON public.payments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- Add checkout time to attendance and FK for joins

ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS check_out timestamptz;

-- FK for PostgREST nested select("*, profiles(...)")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.attendance
    ADD CONSTRAINT attendance_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.checkin_member()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.attendance
  WHERE user_id = auth.uid() AND date = CURRENT_DATE;

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'You can only check in 3 times per day';
  END IF;

  INSERT INTO public.profiles (id, full_name, email)
  SELECT auth.uid(), 'Member', email FROM auth.users WHERE id = auth.uid()
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.attendance (user_id, date, check_in)
  VALUES (auth.uid(), CURRENT_DATE, now())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_member(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.attendance
  SET check_out = now()
  WHERE id = p_id AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.checkin_member TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.checkout_member TO authenticated, anon;
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
-- ============================================================
-- Security & Performance Fixes
-- ============================================================

-- 1. Fix public.auth RLS: restrict anon to reading only email for
--    the matching user_id (login flow), and authenticated to own row.
DROP POLICY IF EXISTS "anon can read auth by user_id" ON public.auth;
DROP POLICY IF EXISTS "authenticated can read own auth" ON public.auth;

CREATE POLICY "anon read auth for login" ON public.auth
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "authenticated read own auth" ON public.auth
  FOR SELECT TO authenticated
  USING (user_id = (SELECT split_part(COALESCE(NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'email', ''), 'unknown'), '@', 1)));

-- 2. Revoke dangerous anon grants on member_plans
REVOKE ALL ON public.member_plans FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_plans TO authenticated;

-- 3. Revoke EXECUTE on admin RPCs from anon (only authenticated should invoke them)
REVOKE EXECUTE ON FUNCTION public.admin_create_user(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_create_user(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_members FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_user FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_renewals FROM anon;
REVOKE EXECUTE ON FUNCTION public.checkin_member FROM anon;
REVOKE EXECUTE ON FUNCTION public.checkout_member FROM anon;
-- Keep has_role accessible to anon (needed for RLS policies to function)

-- 4. Fix admin_update_user: remove reference to non-existent "name" column
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
  SET password = COALESCE(p_password, password)
  WHERE user_id = p_user_id;

  -- Update profile name if provided
  IF p_name IS NOT NULL THEN
    UPDATE public.profiles
    SET full_name = p_name
    WHERE id = (SELECT id FROM auth.users WHERE email = lower(p_user_id) || '@srgym.local');
  END IF;

  RETURN jsonb_build_object('user_id', p_user_id);
END;
$$;

-- 5. Fix admin_create_user: prevent overwriting existing admin accounts
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
  v_existing_role text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Check if target user already exists with admin role and block overwrite
  SELECT role INTO v_existing_role FROM public.auth WHERE user_id = p_id_no;
  IF v_existing_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot modify another admin account';
  END IF;

  INSERT INTO public.auth (user_id, password, role)
  VALUES (p_id_no, p_password, 'member')
  ON CONFLICT (user_id) DO UPDATE
    SET password = EXCLUDED.password,
        role = 'member';

  RETURN jsonb_build_object('user_id', p_id_no);
END;
$$;

-- 6. Drop UNIQUE (user_id, date) on attendance to allow multiple check-ins per day
--    (the 3-per-day limit is enforced server-side in checkin_member RPC)
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_user_id_date_key;

-- 7. Fix checkin_member: add advisory lock to prevent TOCTOU race condition
CREATE OR REPLACE FUNCTION public.checkin_member()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_count integer;
  v_lock_key integer;
BEGIN
  -- Use a session-level advisory lock keyed on the user's UUID hash to
  -- serialize concurrent check-in attempts for the same user.
  v_lock_key := ('x' || substr(md5(auth.uid()::text), 1, 8))::bit(32)::int;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COUNT(*) INTO v_count
  FROM public.attendance
  WHERE user_id = auth.uid() AND date = CURRENT_DATE;

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'You can only check in 3 times per day';
  END IF;

  INSERT INTO public.profiles (id, full_name, email)
  SELECT auth.uid(), 'Member', email FROM auth.users WHERE id = auth.uid()
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.attendance (user_id, date, check_in)
  VALUES (auth.uid(), CURRENT_DATE, now())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

-- 8. Add database indexes for performance
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_end_date ON public.memberships(end_date);
CREATE INDEX IF NOT EXISTS idx_memberships_plan_id ON public.memberships(plan_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_member_plans_user_id ON public.member_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in ON public.attendance(check_in);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance(user_id, date);

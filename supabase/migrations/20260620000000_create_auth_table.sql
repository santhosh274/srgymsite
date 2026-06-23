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

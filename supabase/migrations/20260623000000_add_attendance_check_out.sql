-- Add checkout time to attendance

ALTER TABLE public.attendance
ADD COLUMN IF NOT EXISTS check_out timestamptz;


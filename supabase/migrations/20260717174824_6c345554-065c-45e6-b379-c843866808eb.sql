
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS online_booking_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_advance_min integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_advance_days integer NOT NULL DEFAULT 60;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS default_trial_days integer NOT NULL DEFAULT 15;

UPDATE public.platform_settings
SET default_trial_days = COALESCE(default_trial_days, 15)
WHERE id = true;

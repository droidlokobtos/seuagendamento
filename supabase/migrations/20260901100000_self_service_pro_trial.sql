ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS default_trial_days integer NOT NULL DEFAULT 15;

UPDATE public.platform_settings
SET default_trial_days = COALESCE(default_trial_days, 15)
WHERE id = true;

CREATE OR REPLACE FUNCTION public.plan_mark_expired()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.companies
  SET status = 'trial_expired'
  WHERE is_trial = true
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < CURRENT_DATE
    AND status <> 'trial_expired';
END;
$$;

CREATE OR REPLACE FUNCTION public.is_company_blocked(_company uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_super_admin() THEN false
    ELSE COALESCE((
      SELECT
        c.status IN ('suspended'::public.company_status, 'overdue'::public.company_status, 'trial_expired'::public.company_status)
        OR (c.is_trial = true AND c.trial_ends_at IS NOT NULL AND c.trial_ends_at < CURRENT_DATE)
      FROM public.companies c
      WHERE c.id = _company
    ), false)
  END;
$$;

GRANT EXECUTE ON FUNCTION public.plan_mark_expired() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_blocked(uuid) TO authenticated;

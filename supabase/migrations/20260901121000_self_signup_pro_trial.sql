-- Cadastro autônomo + teste Pro configurável pelo Admin Master

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS trial_days_default integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS trial_plan_code text NOT NULL DEFAULT 'pro';

UPDATE public.platform_settings
SET trial_days_default = COALESCE(trial_days_default, 15),
    trial_plan_code = COALESCE(NULLIF(trial_plan_code, ''), 'pro')
WHERE id = true;

-- Bloqueia acesso quando o teste expira, mesmo antes de qualquer job atualizar o status.
CREATE OR REPLACE FUNCTION public.is_company_blocked(_company uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN public.is_super_admin() THEN false
    ELSE COALESCE((
      SELECT
        c.status::text IN ('suspended', 'overdue', 'trial_expired')
        OR (COALESCE(c.is_trial, false) = true AND c.trial_ends_at IS NOT NULL AND c.trial_ends_at < CURRENT_DATE)
      FROM public.companies c
      WHERE c.id = _company
    ), true)
  END;
$$;

GRANT EXECUTE ON FUNCTION public.is_company_blocked(uuid) TO authenticated;

-- Pode ser chamado por job/rotina administrativa para refletir visualmente a expiração.
CREATE OR REPLACE FUNCTION public.plan_mark_expired()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.companies
     SET status = 'trial_expired'
   WHERE COALESCE(is_trial, false) = true
     AND trial_ends_at IS NOT NULL
     AND trial_ends_at < CURRENT_DATE
     AND status::text = 'trial';
END;
$$;

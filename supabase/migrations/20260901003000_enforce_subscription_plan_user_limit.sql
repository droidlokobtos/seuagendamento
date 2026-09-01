-- Garante no banco o limite de usuários definido em subscription_plans.max_users.
-- Empresas sem plano ou planos sem limite continuam sem restrição.

CREATE OR REPLACE FUNCTION public.enforce_company_plan_user_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_limit integer;
  active_count integer;
BEGIN
  IF COALESCE(NEW.active, true) = false THEN
    RETURN NEW;
  END IF;

  SELECT sp.max_users
    INTO user_limit
  FROM public.companies c
  LEFT JOIN public.subscription_plans sp ON sp.code = c.plan_code
  WHERE c.id = NEW.company_id;

  IF user_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::integer
    INTO active_count
  FROM public.company_users cu
  WHERE cu.company_id = NEW.company_id
    AND cu.active = true
    AND (TG_OP = 'INSERT' OR cu.id <> NEW.id);

  IF active_count >= user_limit THEN
    RAISE EXCEPTION 'Limite de usuários do plano atingido (% usuários).', user_limit
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_company_plan_user_limit ON public.company_users;

CREATE TRIGGER trg_enforce_company_plan_user_limit
BEFORE INSERT OR UPDATE OF active, company_id
ON public.company_users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_company_plan_user_limit();

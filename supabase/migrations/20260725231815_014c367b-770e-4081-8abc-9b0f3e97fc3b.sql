
-- Normalize existing ordering per company (1..n), preserving current order
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY company_id ORDER BY sort_order NULLS LAST, name) AS rn
  FROM public.services
)
UPDATE public.services s SET sort_order = ranked.rn
FROM ranked WHERE ranked.id = s.id AND s.sort_order IS DISTINCT FROM ranked.rn;

-- Transactional reorder, admin-only, company-scoped
CREATE OR REPLACE FUNCTION public.reorder_services(_company uuid, _ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_company_admin(_company) THEN
    RAISE EXCEPTION 'Sem permissão para reordenar serviços';
  END IF;

  UPDATE public.services s
  SET sort_order = v.ord
  FROM (SELECT unnest(_ids) AS id, generate_subscripts(_ids, 1) AS ord) v
  WHERE s.id = v.id
    AND s.company_id = _company
    AND s.sort_order IS DISTINCT FROM v.ord;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_services(uuid, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.reorder_services(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_services(uuid, uuid[]) TO service_role;

-- Resequence after delete so there are never gaps
CREATE OR REPLACE FUNCTION public.resequence_services()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY sort_order NULLS LAST, name) AS rn
    FROM public.services WHERE company_id = OLD.company_id
  )
  UPDATE public.services s SET sort_order = ranked.rn
  FROM ranked WHERE ranked.id = s.id AND s.sort_order IS DISTINCT FROM ranked.rn;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_resequence_services ON public.services;
CREATE TRIGGER trg_resequence_services
AFTER DELETE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.resequence_services();

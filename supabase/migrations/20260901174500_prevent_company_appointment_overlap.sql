-- Regra global de capacidade: uma empresa não pode ter dois atendimentos ativos
-- sobrepostos, independentemente de cliente, serviço ou profissional.
-- O advisory lock serializa reservas concorrentes da mesma empresa.
CREATE OR REPLACE FUNCTION public.prevent_company_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'cancelled_by_customer', 'cancelled_by_company', 'no_show') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.company_id::text));

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.company_id = NEW.company_id
      AND a.id IS DISTINCT FROM NEW.id
      AND a.status NOT IN ('cancelled', 'cancelled_by_customer', 'cancelled_by_company', 'no_show')
      AND a.starts_at < NEW.ends_at
      AND a.ends_at > NEW.starts_at
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'Conflito de agenda: já existe um atendimento neste intervalo.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_company_appointment_overlap ON public.appointments;
CREATE TRIGGER trg_prevent_company_appointment_overlap
BEFORE INSERT OR UPDATE OF company_id, starts_at, ends_at, status
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_company_appointment_overlap();

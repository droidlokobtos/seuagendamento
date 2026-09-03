-- Normalize the identifier used by the ready-made forms already seeded.
UPDATE public.anamnesis_templates template
SET terms = (
  SELECT jsonb_agg(
    CASE
      WHEN term ->> 'id' = 'veracidade' THEN jsonb_set(term, '{id}', '"truth"'::jsonb)
      ELSE term
    END
  )
  FROM jsonb_array_elements(template.terms) term
)
WHERE template.terms @> '[{"id":"veracidade"}]'::jsonb;

-- A service cannot be exposed in the public booking link without an active,
-- specifically linked form. New services therefore remain internal until the
-- administrator saves their form.
CREATE OR REPLACE FUNCTION public.enforce_service_form_before_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.show_on_booking = true AND NOT EXISTS (
    SELECT 1
    FROM public.anamnesis_templates template
    WHERE template.company_id = NEW.company_id
      AND template.active = true
      AND template.service_ids @> ARRAY[NEW.id]::uuid[]
  ) THEN
    NEW.show_on_booking := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_services_require_form_before_booking ON public.services;
CREATE TRIGGER trg_services_require_form_before_booking
  BEFORE INSERT OR UPDATE OF show_on_booking ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.enforce_service_form_before_booking();

-- Removing, unlinking or disabling the last active form hides the affected
-- services again instead of leaving an invalid public booking option.
CREATE OR REPLACE FUNCTION public.hide_services_without_active_form()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  affected_service_ids uuid[];
  affected_company_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_service_ids := OLD.service_ids;
    affected_company_id := OLD.company_id;
  ELSE
    affected_service_ids := coalesce(OLD.service_ids, '{}'::uuid[]) || coalesce(NEW.service_ids, '{}'::uuid[]);
    affected_company_id := NEW.company_id;
  END IF;

  UPDATE public.services service
  SET show_on_booking = false
  WHERE service.company_id = affected_company_id
    AND service.id = ANY(affected_service_ids)
    AND NOT EXISTS (
      SELECT 1
      FROM public.anamnesis_templates template
      WHERE template.company_id = service.company_id
        AND template.active = true
        AND template.service_ids @> ARRAY[service.id]::uuid[]
    );
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_templates_hide_uncovered_services_update ON public.anamnesis_templates;
CREATE TRIGGER trg_templates_hide_uncovered_services_update
  AFTER UPDATE OF active, service_ids ON public.anamnesis_templates
  FOR EACH ROW EXECUTE FUNCTION public.hide_services_without_active_form();

DROP TRIGGER IF EXISTS trg_templates_hide_uncovered_services_delete ON public.anamnesis_templates;
CREATE TRIGGER trg_templates_hide_uncovered_services_delete
  AFTER DELETE ON public.anamnesis_templates
  FOR EACH ROW EXECUTE FUNCTION public.hide_services_without_active_form();

-- Preserve historical duplicates if any exist, but reject every new duplicate
-- of the same template in the same appointment at database level.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_appointment_form()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.appointment_id IS NOT NULL AND NEW.template_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended(NEW.appointment_id::text || ':' || NEW.template_id::text, 0)
    );
  END IF;

  IF NEW.appointment_id IS NOT NULL AND NEW.template_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.anamnesis_records record
      WHERE record.appointment_id = NEW.appointment_id
        AND record.template_id = NEW.template_id
    ) THEN
    RAISE EXCEPTION 'Esta ficha já foi preenchida para este atendimento.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anamnesis_prevent_duplicate_appointment_form ON public.anamnesis_records;
CREATE TRIGGER trg_anamnesis_prevent_duplicate_appointment_form
  BEFORE INSERT ON public.anamnesis_records
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_appointment_form();

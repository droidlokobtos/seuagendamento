CREATE TABLE public.anamnesis_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  sections text[] NOT NULL DEFAULT '{}',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  alerts text[] NOT NULL DEFAULT '{}',
  consent_truth boolean NOT NULL DEFAULT false,
  consent_procedure boolean NOT NULL DEFAULT false,
  consent_lgpd boolean NOT NULL DEFAULT false,
  signature_data text,
  filled_by text NOT NULL DEFAULT 'customer',
  actor_user_id uuid,
  filled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anamnesis_filled_by_chk CHECK (filled_by IN ('customer','admin'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anamnesis_records TO authenticated;
GRANT ALL ON public.anamnesis_records TO service_role;

ALTER TABLE public.anamnesis_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins manage anamnesis"
  ON public.anamnesis_records FOR ALL TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

CREATE INDEX idx_anamnesis_customer ON public.anamnesis_records (customer_id, filled_at DESC);
CREATE INDEX idx_anamnesis_company ON public.anamnesis_records (company_id, filled_at DESC);

CREATE TRIGGER trg_anamnesis_touch
  BEFORE UPDATE ON public.anamnesis_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.anamnesis_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid,
  record_id uuid,
  action text NOT NULL,
  detail text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.anamnesis_access_log TO authenticated;
GRANT ALL ON public.anamnesis_access_log TO service_role;

ALTER TABLE public.anamnesis_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins read anamnesis log"
  ON public.anamnesis_access_log FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id));

CREATE POLICY "Company admins write anamnesis log"
  ON public.anamnesis_access_log FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));

CREATE INDEX idx_anamnesis_log_company ON public.anamnesis_access_log (company_id, created_at DESC);

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS anamnesis_section text;
CREATE TABLE public.anamnesis_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  service_ids uuid[] NOT NULL DEFAULT '{}',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  require_signature boolean NOT NULL DEFAULT true,
  allow_before_photos boolean NOT NULL DEFAULT false,
  allow_after_photos boolean NOT NULL DEFAULT false,
  validity_months integer NOT NULL DEFAULT 6 CHECK (validity_months BETWEEN 1 AND 60),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT anamnesis_templates_sections_array CHECK (jsonb_typeof(sections) = 'array'),
  CONSTRAINT anamnesis_templates_terms_array CHECK (jsonb_typeof(terms) = 'array')
);

CREATE INDEX idx_anamnesis_templates_company ON public.anamnesis_templates(company_id, active);
CREATE INDEX idx_anamnesis_templates_services ON public.anamnesis_templates USING gin(service_ids);
ALTER TABLE public.anamnesis_templates ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anamnesis_templates TO authenticated;
GRANT ALL ON public.anamnesis_templates TO service_role;

CREATE POLICY "permission scoped access" ON public.anamnesis_templates
  FOR ALL TO authenticated
  USING (public.has_any_permission(company_id, ARRAY['clientes','servicos','configuracoes']))
  WITH CHECK (public.has_any_permission(company_id, ARRAY['clientes','servicos','configuracoes']));

CREATE TRIGGER trg_anamnesis_templates_touch
  BEFORE UPDATE ON public.anamnesis_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.anamnesis_records
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.anamnesis_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS consent_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS before_photo_paths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS after_photo_paths text[] NOT NULL DEFAULT '{}';

DROP POLICY IF EXISTS "company members read anamnesis media" ON storage.objects;
CREATE POLICY "company members read anamnesis media" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'anamnesis-media'
    AND public.has_any_permission((storage.foldername(name))[1]::uuid, ARRAY['clientes'])
  );

DROP POLICY IF EXISTS "company admins manage anamnesis media" ON storage.objects;
CREATE POLICY "company admins manage anamnesis media" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'anamnesis-media'
    AND public.has_any_permission((storage.foldername(name))[1]::uuid, ARRAY['clientes','configuracoes'])
  )
  WITH CHECK (
    bucket_id = 'anamnesis-media'
    AND public.has_any_permission((storage.foldername(name))[1]::uuid, ARRAY['clientes','configuracoes'])
  );
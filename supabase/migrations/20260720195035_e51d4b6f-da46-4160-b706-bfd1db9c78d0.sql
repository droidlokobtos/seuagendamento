
CREATE TABLE public.sub_niches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  niche_id UUID NOT NULL REFERENCES public.niches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (niche_id, name)
);

GRANT SELECT ON public.sub_niches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_niches TO authenticated;
GRANT ALL ON public.sub_niches TO service_role;

ALTER TABLE public.sub_niches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub_niches readable by anyone"
  ON public.sub_niches FOR SELECT
  USING (true);

CREATE POLICY "sub_niches managed by super admin"
  ON public.sub_niches FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE TRIGGER trg_sub_niches_updated
  BEFORE UPDATE ON public.sub_niches
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.companies
  ADD COLUMN sub_niche_id UUID REFERENCES public.sub_niches(id) ON DELETE SET NULL;

CREATE INDEX idx_sub_niches_niche ON public.sub_niches(niche_id);
CREATE INDEX idx_companies_sub_niche ON public.companies(sub_niche_id);


ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS buffer_min integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.time_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_blocks TO authenticated;
GRANT SELECT ON public.time_blocks TO anon;
GRANT ALL ON public.time_blocks TO service_role;

ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tb member read" ON public.time_blocks FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "tb member write" ON public.time_blocks TO authenticated USING (is_company_member(company_id)) WITH CHECK (is_company_member(company_id));
CREATE POLICY "tb public read" ON public.time_blocks FOR SELECT TO anon USING (true);

CREATE INDEX IF NOT EXISTS time_blocks_company_starts_idx ON public.time_blocks (company_id, starts_at);
CREATE INDEX IF NOT EXISTS time_blocks_staff_starts_idx ON public.time_blocks (staff_id, starts_at);

CREATE TRIGGER time_blocks_touch BEFORE UPDATE ON public.time_blocks FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

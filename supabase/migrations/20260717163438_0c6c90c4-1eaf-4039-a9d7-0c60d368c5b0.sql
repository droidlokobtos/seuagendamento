
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS parent_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS app_icon_url TEXT,
  ADD COLUMN IF NOT EXISTS listed_in_marketplace BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);

CREATE INDEX IF NOT EXISTS companies_parent_idx ON public.companies(parent_company_id);
CREATE INDEX IF NOT EXISTS companies_marketplace_idx ON public.companies(listed_in_marketplace) WHERE listed_in_marketplace = true;

-- Allow anon to see marketplace companies (only safe columns via view / policy already allows read of public columns via /b/:slug)
DROP POLICY IF EXISTS "Marketplace public read" ON public.companies;
CREATE POLICY "Marketplace public read"
  ON public.companies FOR SELECT
  TO anon, authenticated
  USING (listed_in_marketplace = true AND status <> 'suspended');

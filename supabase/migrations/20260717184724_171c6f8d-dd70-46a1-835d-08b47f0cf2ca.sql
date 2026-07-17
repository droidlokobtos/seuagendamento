
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS welcome_message text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text,
  ADD COLUMN IF NOT EXISTS tiktok_url text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS show_staff_on_portal boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_reviews_on_portal boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reviews' AND policyname='Public can read published reviews'
  ) THEN
    CREATE POLICY "Public can read published reviews"
      ON public.reviews FOR SELECT
      TO anon, authenticated
      USING (published = true);
  END IF;
END $$;

GRANT SELECT ON public.reviews TO anon;

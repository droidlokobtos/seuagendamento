
CREATE TABLE public.gallery_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category TEXT,
  title TEXT,
  description TEXT,
  image_url TEXT NOT NULL,
  featured BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX gallery_photos_company_idx ON public.gallery_photos(company_id, created_at DESC);
CREATE INDEX gallery_photos_featured_idx ON public.gallery_photos(company_id, featured);

GRANT SELECT ON public.gallery_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_photos TO authenticated;
GRANT ALL ON public.gallery_photos TO service_role;

ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view gallery of active companies"
  ON public.gallery_photos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = gallery_photos.company_id
        AND (c.status IS NULL OR c.status <> 'suspended')
    )
  );

CREATE POLICY "Company members manage gallery"
  ON public.gallery_photos FOR ALL
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER gallery_photos_touch
  BEFORE UPDATE ON public.gallery_photos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

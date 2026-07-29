DROP POLICY IF EXISTS "Public can view gallery of active companies" ON public.gallery_photos;
CREATE POLICY "Public can view gallery of active companies"
  ON public.gallery_photos FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = gallery_photos.company_id
      AND c.status <> 'suspended'::company_status
  ));
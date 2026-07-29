-- 1. COMPANIES: remove leitura anônima de todas as colunas
DROP POLICY IF EXISTS "Public read active company" ON public.companies;
DROP POLICY IF EXISTS "Marketplace public read" ON public.companies;

CREATE OR REPLACE VIEW public.public_companies AS
SELECT id, niche_id, sub_niche_id, name, slug, logo_url, banner_url, app_icon_url,
       primary_color, secondary_color, theme, address, city, state, latitude, longitude,
       phone, whatsapp, status, listed_in_marketplace, short_description, description,
       welcome_message, instagram_url, facebook_url, tiktok_url, website_url,
       show_staff_on_portal, show_reviews_on_portal, amenities,
       online_booking_enabled, min_advance_min, max_advance_days, buffer_min,
       deposit_enabled, deposit_type, deposit_value
FROM public.companies
WHERE status <> 'suspended';

GRANT SELECT ON public.public_companies TO anon, authenticated;

-- 2. STAFF: sem leitura anônima (portal público usa API server-side)
DROP POLICY IF EXISTS "Public read active staff" ON public.staff;

-- 3. TIME BLOCKS: expõe só o necessário para disponibilidade
DROP POLICY IF EXISTS "tb public read" ON public.time_blocks;

CREATE OR REPLACE VIEW public.public_time_blocks AS
SELECT id, company_id, staff_id, starts_at, ends_at
FROM public.time_blocks;

GRANT SELECT ON public.public_time_blocks TO anon, authenticated;

-- 4. PLATFORM SETTINGS: só super admin lê
DROP POLICY IF EXISTS "Anyone auth reads settings" ON public.platform_settings;
CREATE POLICY "Super admin reads settings" ON public.platform_settings
  FOR SELECT TO authenticated USING (public.is_super_admin());

-- 5. STORAGE: escopo por empresa (primeira pasta do caminho = company_id)
DROP POLICY IF EXISTS "authenticated read company-assets" ON storage.objects;
DROP POLICY IF EXISTS "authenticated insert company-assets" ON storage.objects;
DROP POLICY IF EXISTS "authenticated update company-assets" ON storage.objects;
DROP POLICY IF EXISTS "authenticated delete company-assets" ON storage.objects;

CREATE POLICY "company members read company-assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND public.is_company_member(NULLIF((storage.foldername(name))[1], '')::uuid)
  );

CREATE POLICY "company members insert company-assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-assets'
    AND public.is_company_member(NULLIF((storage.foldername(name))[1], '')::uuid)
  );

CREATE POLICY "company members update company-assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND public.is_company_member(NULLIF((storage.foldername(name))[1], '')::uuid)
  )
  WITH CHECK (
    bucket_id = 'company-assets'
    AND public.is_company_member(NULLIF((storage.foldername(name))[1], '')::uuid)
  );

CREATE POLICY "company members delete company-assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-assets'
    AND public.is_company_member(NULLIF((storage.foldername(name))[1], '')::uuid)
  );

-- 6. Funções SECURITY DEFINER: remove execução pela API, exceto as necessárias
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_company_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_services(uuid, uuid[]) TO authenticated;
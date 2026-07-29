-- =========================================================
-- 1) VIEWS: passam a respeitar as permissões de quem consulta
-- =========================================================
ALTER VIEW public.public_companies SET (security_invoker = true);
ALTER VIEW public.public_time_blocks SET (security_invoker = true);

-- =========================================================
-- 2) companies: anon lê apenas colunas de vitrine
-- =========================================================
REVOKE SELECT ON public.companies FROM anon;
GRANT SELECT (
  id, niche_id, sub_niche_id, name, slug, logo_url, banner_url, app_icon_url,
  primary_color, secondary_color, theme, address, city, state, latitude, longitude,
  phone, whatsapp, status, listed_in_marketplace, short_description, description,
  welcome_message, instagram_url, facebook_url, tiktok_url, website_url,
  show_staff_on_portal, show_reviews_on_portal, amenities, online_booking_enabled,
  min_advance_min, max_advance_days, buffer_min,
  deposit_enabled, deposit_type, deposit_value
) ON public.companies TO anon;

DROP POLICY IF EXISTS "Public reads showcase companies" ON public.companies;
CREATE POLICY "Public reads showcase companies"
  ON public.companies FOR SELECT TO anon
  USING (status <> 'suspended'::company_status);

-- =========================================================
-- 3) time_blocks: anon lê apenas janelas de horário (sem motivo)
-- =========================================================
REVOKE SELECT ON public.time_blocks FROM anon;
GRANT SELECT (id, company_id, staff_id, starts_at, ends_at) ON public.time_blocks TO anon;

DROP POLICY IF EXISTS "Public reads blocks of active companies" ON public.time_blocks;
CREATE POLICY "Public reads blocks of active companies"
  ON public.time_blocks FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = time_blocks.company_id
      AND c.status <> 'suspended'::company_status
  ));

-- =========================================================
-- 4) services: anon lê apenas colunas de catálogo, de empresas ativas
-- =========================================================
REVOKE SELECT ON public.services FROM anon;
GRANT SELECT (
  id, company_id, name, description, duration_min, price_cents,
  category, color, photo_url, photo_position, sort_order, active
) ON public.services TO anon;

DROP POLICY IF EXISTS "Public read active services" ON public.services;
DROP POLICY IF EXISTS "Public reads active services of active companies" ON public.services;
CREATE POLICY "Public reads active services of active companies"
  ON public.services FOR SELECT TO anon
  USING (
    active
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = services.company_id
        AND c.status <> 'suspended'::company_status
    )
  );

-- =========================================================
-- 5) company_hours: anon apenas de empresas ativas
-- =========================================================
DROP POLICY IF EXISTS "Public read company hours" ON public.company_hours;
DROP POLICY IF EXISTS "Public reads hours of active companies" ON public.company_hours;
CREATE POLICY "Public reads hours of active companies"
  ON public.company_hours FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_hours.company_id
      AND c.status <> 'suspended'::company_status
  ));

-- =========================================================
-- 6) loyalty_rewards: anon apenas recompensas ativas de empresas ativas
-- =========================================================
DROP POLICY IF EXISTS "Public reads active rewards" ON public.loyalty_rewards;
DROP POLICY IF EXISTS "Public reads active rewards of active companies" ON public.loyalty_rewards;
CREATE POLICY "Public reads active rewards of active companies"
  ON public.loyalty_rewards FOR SELECT TO anon
  USING (
    active
    AND EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = loyalty_rewards.company_id
        AND c.status <> 'suspended'::company_status
    )
  );

-- =========================================================
-- 7) Políticas de tenant restritas ao papel "authenticated"
-- =========================================================
DROP POLICY IF EXISTS "Members read financial" ON public.financial_transactions;
DROP POLICY IF EXISTS "Members write financial" ON public.financial_transactions;
CREATE POLICY "Members read financial"
  ON public.financial_transactions FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "Members write financial"
  ON public.financial_transactions FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Members read products" ON public.products;
DROP POLICY IF EXISTS "Members write products" ON public.products;
CREATE POLICY "Members read products"
  ON public.products FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "Members write products"
  ON public.products FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Members read movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Members write movements" ON public.inventory_movements;
CREATE POLICY "Members read movements"
  ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "Members write movements"
  ON public.inventory_movements FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Company members manage gallery" ON public.gallery_photos;
CREATE POLICY "Company members manage gallery"
  ON public.gallery_photos FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "Public can view gallery of active companies" ON public.gallery_photos;
CREATE POLICY "Public can view gallery of active companies"
  ON public.gallery_photos FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = gallery_photos.company_id
      AND c.status <> 'suspended'::company_status
  ));

-- =========================================================
-- 8) Funções SECURITY DEFINER: remover execução pública
-- =========================================================
REVOKE ALL ON FUNCTION public.log_attendance_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_attendance_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.customer_booking_rule(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_booking_rule(uuid, uuid) TO service_role;

-- customer_reliability continua disponível ao painel, mas isolada por empresa
CREATE OR REPLACE FUNCTION public.customer_reliability(_company uuid)
RETURNS TABLE(
  customer_id uuid, completed integer, no_shows integer, late_cancels integer,
  cancels integer, total integer, attendance_rate numeric, score integer,
  classification text, last_event_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_company_member(_company) THEN
    RAISE EXCEPTION 'Sem permissão para consultar esta empresa';
  END IF;

  RETURN QUERY
  WITH cfg AS (
    SELECT COALESCE(s.lookback_days, 180) AS lookback,
           COALESCE(s.weight_completed, 4) AS w_ok,
           COALESCE(s.weight_no_show, -25) AS w_ns,
           COALESCE(s.weight_late_cancel, -12) AS w_lc,
           COALESCE(s.weight_cancel, -4) AS w_c,
           COALESCE(s.attention_score, 70) AS t_att,
           COALESCE(s.risk_score, 40) AS t_risk
    FROM (SELECT 1) x
    LEFT JOIN public.attendance_settings s ON s.company_id = _company
  ), agg AS (
    SELECT
      e.customer_id AS cid,
      COUNT(*) FILTER (WHERE e.event = 'completed')::int AS ok,
      COUNT(*) FILTER (WHERE e.event = 'no_show')::int AS ns,
      COUNT(*) FILTER (WHERE e.event = 'late_cancel')::int AS lc,
      COUNT(*) FILTER (WHERE e.event IN ('cancelled', 'cancelled_by_customer'))::int AS c,
      COUNT(*)::int AS tot,
      MAX(e.occurred_at) AS last_at
    FROM public.attendance_events e, cfg
    WHERE e.company_id = _company
      AND e.event <> 'cancelled_by_company'
      AND e.occurred_at >= now() - (cfg.lookback || ' days')::interval
    GROUP BY e.customer_id
  )
  SELECT
    a.cid,
    a.ok,
    a.ns,
    a.lc,
    a.c,
    a.tot,
    CASE WHEN (a.ok + a.ns) > 0
         THEN ROUND((a.ok * 100.0) / (a.ok + a.ns), 1)
         ELSE 100::numeric END,
    GREATEST(0, LEAST(100, 70 + a.ok * cfg.w_ok + a.ns * cfg.w_ns + a.lc * cfg.w_lc + a.c * cfg.w_c))::int,
    CASE
      WHEN GREATEST(0, LEAST(100, 70 + a.ok * cfg.w_ok + a.ns * cfg.w_ns + a.lc * cfg.w_lc + a.c * cfg.w_c)) < cfg.t_risk THEN 'high_risk'
      WHEN GREATEST(0, LEAST(100, 70 + a.ok * cfg.w_ok + a.ns * cfg.w_ns + a.lc * cfg.w_lc + a.c * cfg.w_c)) < cfg.t_att THEN 'attention'
      ELSE 'reliable'
    END,
    a.last_at
  FROM agg a, cfg;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_reliability(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_reliability(uuid) TO authenticated, service_role;

-- 1. procedures: novos campos
ALTER TABLE public.procedures
  ADD COLUMN IF NOT EXISTS subcategory text,
  ADD COLUMN IF NOT EXISTS duration_min_min integer,
  ADD COLUMN IF NOT EXISTS duration_max_min integer,
  ADD COLUMN IF NOT EXISTS promo_price_cents integer,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS target_margin_pct numeric(6,2) NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS block_below_cost boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS apply_overhead boolean NOT NULL DEFAULT true;

-- 2. procedure_items: conversão de unidade
ALTER TABLE public.procedure_items
  ADD COLUMN IF NOT EXISTS purchase_unit text,
  ADD COLUMN IF NOT EXISTS consumption_unit text,
  ADD COLUMN IF NOT EXISTS conversion_factor numeric(16,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS converted_qty numeric(16,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text;

UPDATE public.procedure_items
   SET consumption_unit = COALESCE(consumption_unit, unit),
       purchase_unit = COALESCE(purchase_unit, unit),
       converted_qty = CASE WHEN converted_qty = 0 THEN quantity ELSE converted_qty END;

CREATE OR REPLACE FUNCTION public.procedure_item_convert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.consumption_unit := COALESCE(NEW.consumption_unit, NEW.unit);
  NEW.purchase_unit := COALESCE(NEW.purchase_unit, NEW.unit);
  IF NEW.conversion_factor IS NULL OR NEW.conversion_factor <= 0 THEN
    NEW.conversion_factor := 1;
  END IF;
  NEW.converted_qty := COALESCE(NEW.quantity, 0) * NEW.conversion_factor;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_procedure_items_convert ON public.procedure_items;
CREATE TRIGGER trg_procedure_items_convert
BEFORE INSERT OR UPDATE ON public.procedure_items
FOR EACH ROW EXECUTE FUNCTION public.procedure_item_convert();

-- 3. Conversões de unidade
CREATE TABLE IF NOT EXISTS public.unit_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_unit text NOT NULL,
  to_unit text NOT NULL,
  factor numeric(16,6) NOT NULL CHECK (factor > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, from_unit, to_unit)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unit_conversions TO authenticated;
GRANT ALL ON public.unit_conversions TO service_role;
ALTER TABLE public.unit_conversions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read unit conversions" ON public.unit_conversions FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins manage unit conversions" ON public.unit_conversions TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE TRIGGER trg_unit_conversions_touch BEFORE UPDATE ON public.unit_conversions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Custos operacionais da empresa
CREATE TABLE IF NOT EXISTS public.overhead_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  monthly_cents integer NOT NULL DEFAULT 0,
  include_in_costing boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.overhead_costs TO authenticated;
GRANT ALL ON public.overhead_costs TO service_role;
ALTER TABLE public.overhead_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read overhead costs" ON public.overhead_costs FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins manage overhead costs" ON public.overhead_costs TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE TRIGGER trg_overhead_costs_touch BEFORE UPDATE ON public.overhead_costs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Configuração de custeio
CREATE TABLE IF NOT EXISTS public.costing_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  allocation_basis text NOT NULL DEFAULT 'hour',
  monthly_hours numeric(10,2) NOT NULL DEFAULT 160,
  monthly_appointments integer NOT NULL DEFAULT 100,
  default_margin_pct numeric(6,2) NOT NULL DEFAULT 40,
  min_margin_pct numeric(6,2) NOT NULL DEFAULT 10,
  block_below_cost boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.costing_settings TO authenticated;
GRANT ALL ON public.costing_settings TO service_role;
ALTER TABLE public.costing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read costing settings" ON public.costing_settings FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins manage costing settings" ON public.costing_settings TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE TRIGGER trg_costing_settings_touch BEFORE UPDATE ON public.costing_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Preço por profissional
CREATE TABLE IF NOT EXISTS public.procedure_staff_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  price_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (procedure_id, staff_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedure_staff_prices TO authenticated;
GRANT ALL ON public.procedure_staff_prices TO service_role;
ALTER TABLE public.procedure_staff_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read procedure staff prices" ON public.procedure_staff_prices FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins manage procedure staff prices" ON public.procedure_staff_prices TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE TRIGGER trg_procedure_staff_prices_touch BEFORE UPDATE ON public.procedure_staff_prices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. Versões do procedimento
CREATE TABLE IF NOT EXISTS public.procedure_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL,
  totals jsonb,
  note text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_procedure_versions_proc ON public.procedure_versions (procedure_id, created_at DESC);
GRANT SELECT, INSERT ON public.procedure_versions TO authenticated;
GRANT ALL ON public.procedure_versions TO service_role;
ALTER TABLE public.procedure_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read procedure versions" ON public.procedure_versions FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins insert procedure versions" ON public.procedure_versions FOR INSERT TO authenticated WITH CHECK (public.is_company_admin(company_id));

-- 8. Baixa automática usa quantidade convertida
CREATE OR REPLACE FUNCTION public.consume_procedure_supplies()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it record; stf_name text; cust_name text; low_cnt integer; total_cost numeric := 0;
BEGIN
  IF NEW.status::text <> 'completed' OR OLD.status::text = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO stf_name FROM public.staff WHERE id = NEW.staff_id;
  SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;

  FOR it IN
    SELECT pi.product_id,
           GREATEST(COALESCE(pi.converted_qty, pi.quantity), 0) AS qty,
           pi.unit_cost, s.name AS service_name, p.name AS proc_name
    FROM public.appointment_services aps
    JOIN public.services s ON s.id = aps.service_id
    JOIN public.procedures p ON p.service_id = aps.service_id AND p.company_id = NEW.company_id AND p.active
    JOIN public.procedure_items pi ON pi.procedure_id = p.id
    WHERE aps.appointment_id = NEW.id AND pi.product_id IS NOT NULL AND pi.quantity > 0
  LOOP
    IF it.qty <= 0 THEN CONTINUE; END IF;

    INSERT INTO public.inventory_movements
      (company_id, product_id, type, quantity, unit_cost, reason, appointment_id, created_by)
    VALUES (
      NEW.company_id, it.product_id, 'out', it.qty, it.unit_cost,
      'Procedimento: ' || it.proc_name || ' · ' || it.service_name ||
      COALESCE(' · Cliente: ' || cust_name, '') || COALESCE(' · Prof.: ' || stf_name, ''),
      NEW.id, auth.uid()
    );
    total_cost := total_cost + (it.qty * COALESCE(it.unit_cost, 0));
  END LOOP;

  IF total_cost > 0 THEN
    INSERT INTO public.financial_audit_log (company_id, appointment_id, action, description, amount_cents, actor_user_id)
    VALUES (NEW.company_id, NEW.id, 'procedure_cost', 'Custo de insumos do atendimento',
            round(total_cost * 100)::int, auth.uid());
  END IF;

  SELECT COUNT(*) INTO low_cnt FROM public.products pr
   WHERE pr.company_id = NEW.company_id AND pr.active AND pr.stock_qty <= pr.min_stock;

  IF low_cnt > 0 THEN
    INSERT INTO public.notifications (company_id, kind, title, body, link, metadata)
    VALUES (NEW.company_id, 'stock_low', 'Estoque baixo',
      low_cnt || ' produto(s) no estoque mínimo ou zerados', '/app/products',
      jsonb_build_object('appointment_id', NEW.id, 'count', low_cnt));
  END IF;

  RETURN NEW;
END; $$;

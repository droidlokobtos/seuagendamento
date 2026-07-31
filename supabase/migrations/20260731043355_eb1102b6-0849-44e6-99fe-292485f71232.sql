
CREATE TABLE public.procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  category text,
  duration_min integer NOT NULL DEFAULT 60,
  suggested_price_cents integer NOT NULL DEFAULT 0,
  min_price_cents integer NOT NULL DEFAULT 0,
  ideal_price_cents integer NOT NULL DEFAULT 0,
  practiced_price_cents integer,
  description text,
  active boolean NOT NULL DEFAULT true,
  labor_hour_rate_cents integer NOT NULL DEFAULT 0,
  commission_type text NOT NULL DEFAULT 'percent',
  commission_value numeric(12,2) NOT NULL DEFAULT 0,
  other_costs_cents integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_procedures_company ON public.procedures(company_id, active);
CREATE INDEX idx_procedures_service ON public.procedures(service_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedures TO authenticated;
GRANT ALL ON public.procedures TO service_role;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read procedures" ON public.procedures FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins manage procedures" ON public.procedures FOR ALL TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE TRIGGER trg_procedures_touch BEFORE UPDATE ON public.procedures FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.procedure_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text,
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'un',
  unit_cost numeric(12,4) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_procedure_items_proc ON public.procedure_items(procedure_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedure_items TO authenticated;
GRANT ALL ON public.procedure_items TO service_role;
ALTER TABLE public.procedure_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read procedure items" ON public.procedure_items FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins manage procedure items" ON public.procedure_items FOR ALL TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE TRIGGER trg_procedure_items_touch BEFORE UPDATE ON public.procedure_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.procedure_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_procedure_costs_proc ON public.procedure_costs(procedure_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.procedure_costs TO authenticated;
GRANT ALL ON public.procedure_costs TO service_role;
ALTER TABLE public.procedure_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read procedure costs" ON public.procedure_costs FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admins manage procedure costs" ON public.procedure_costs FOR ALL TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE TRIGGER trg_procedure_costs_touch BEFORE UPDATE ON public.procedure_costs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.procedure_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  procedure_id uuid,
  procedure_name text,
  entity text NOT NULL,
  action text NOT NULL,
  description text,
  old_data jsonb,
  new_data jsonb,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_procedure_audit_company ON public.procedure_audit_log(company_id, created_at DESC);
GRANT SELECT, INSERT ON public.procedure_audit_log TO authenticated;
GRANT ALL ON public.procedure_audit_log TO service_role;
ALTER TABLE public.procedure_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read procedure audit" ON public.procedure_audit_log FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Members insert procedure audit" ON public.procedure_audit_log FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));

-- audit triggers
CREATE OR REPLACE FUNCTION public.audit_procedure_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  comp uuid; proc uuid; pname text; act text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    comp := OLD.company_id; act := 'deleted';
  ELSIF TG_OP = 'INSERT' THEN
    comp := NEW.company_id; act := 'created';
  ELSE
    comp := NEW.company_id; act := 'updated';
  END IF;

  IF TG_TABLE_NAME = 'procedures' THEN
    proc := COALESCE(NEW.id, OLD.id);
    pname := COALESCE(NEW.name, OLD.name);
  ELSE
    proc := COALESCE(NEW.procedure_id, OLD.procedure_id);
    SELECT name INTO pname FROM public.procedures WHERE id = proc;
  END IF;

  INSERT INTO public.procedure_audit_log
    (company_id, procedure_id, procedure_name, entity, action, description, old_data, new_data, actor_user_id)
  VALUES (
    comp, proc, pname,
    CASE TG_TABLE_NAME WHEN 'procedures' THEN 'procedure' WHEN 'procedure_items' THEN 'item' ELSE 'cost' END,
    act, NULL,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    auth.uid()
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_audit_procedures AFTER INSERT OR UPDATE OR DELETE ON public.procedures
  FOR EACH ROW EXECUTE FUNCTION public.audit_procedure_changes();
CREATE TRIGGER trg_audit_procedure_items AFTER INSERT OR UPDATE OR DELETE ON public.procedure_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_procedure_changes();
CREATE TRIGGER trg_audit_procedure_costs AFTER INSERT OR UPDATE OR DELETE ON public.procedure_costs
  FOR EACH ROW EXECUTE FUNCTION public.audit_procedure_changes();

-- auto stock deduction when an appointment is completed
CREATE OR REPLACE FUNCTION public.consume_procedure_supplies()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  it record; stf_name text; cust_name text; low_cnt integer;
BEGIN
  IF NEW.status::text <> 'completed' OR OLD.status::text = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO stf_name FROM public.staff WHERE id = NEW.staff_id;
  SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;

  FOR it IN
    SELECT pi.product_id, pi.quantity, pi.unit_cost, s.name AS service_name, p.name AS proc_name
    FROM public.appointment_services aps
    JOIN public.services s ON s.id = aps.service_id
    JOIN public.procedures p ON p.service_id = aps.service_id AND p.company_id = NEW.company_id AND p.active
    JOIN public.procedure_items pi ON pi.procedure_id = p.id
    WHERE aps.appointment_id = NEW.id AND pi.product_id IS NOT NULL AND pi.quantity > 0
  LOOP
    INSERT INTO public.inventory_movements
      (company_id, product_id, type, quantity, unit_cost, reason, appointment_id, created_by)
    VALUES (
      NEW.company_id, it.product_id, 'out', it.quantity, it.unit_cost,
      'Procedimento: ' || it.proc_name || ' · ' || it.service_name ||
      COALESCE(' · Cliente: ' || cust_name, '') || COALESCE(' · Prof.: ' || stf_name, ''),
      NEW.id, auth.uid()
    );
  END LOOP;

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

CREATE TRIGGER trg_consume_procedure_supplies
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.consume_procedure_supplies();

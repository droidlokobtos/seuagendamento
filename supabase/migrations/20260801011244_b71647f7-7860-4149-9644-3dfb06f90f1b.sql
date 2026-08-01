
-- 1. PRODUCTS: extra fields + scope
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'service',
  ADD COLUMN IF NOT EXISTS internal_code text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS ideal_stock numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_cost numeric,
  ADD COLUMN IF NOT EXISTS promo_price numeric,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS batch text,
  ADD COLUMN IF NOT EXISTS expires_on date,
  ADD COLUMN IF NOT EXISTS image_url text;

DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_scope_check CHECK (scope IN ('service','sale'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS products_company_scope_idx ON public.products(company_id, scope);

-- 2. INVENTORY MOVEMENTS: operation kind + cost tracking
ALTER TABLE public.inventory_movements
  ADD COLUMN IF NOT EXISTS operation text,
  ADD COLUMN IF NOT EXISTS sale_id uuid,
  ADD COLUMN IF NOT EXISTS total_cost numeric;

CREATE OR REPLACE FUNCTION public.update_product_costs()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur numeric; cur_avg numeric;
BEGIN
  IF NEW.type = 'in' AND NEW.unit_cost IS NOT NULL AND NEW.unit_cost > 0 THEN
    SELECT stock_qty, avg_cost INTO cur, cur_avg FROM public.products WHERE id = NEW.product_id;
    UPDATE public.products
       SET last_cost = NEW.unit_cost,
           cost_price = NEW.unit_cost,
           avg_cost = CASE
             WHEN COALESCE(cur,0) + NEW.quantity > 0
               THEN ((COALESCE(cur,0) * COALESCE(cur_avg,0)) + (NEW.quantity * NEW.unit_cost)) / (COALESCE(cur,0) + NEW.quantity)
             ELSE NEW.unit_cost END
     WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_update_product_costs ON public.inventory_movements;
CREATE TRIGGER trg_update_product_costs BEFORE INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.update_product_costs();

-- 3. PAYMENT OPTIONS (custom payment methods)
CREATE TABLE IF NOT EXISTS public.payment_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_options TO authenticated;
GRANT ALL ON public.payment_options TO service_role;
ALTER TABLE public.payment_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_options_member" ON public.payment_options FOR ALL TO authenticated
  USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER trg_payment_options_touch BEFORE UPDATE ON public.payment_options
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.payment_options (company_id, name, sort_order)
SELECT c.id, v.name, v.ord
FROM public.companies c
CROSS JOIN (VALUES ('PIX',1),('Dinheiro',2),('Cartão de Débito',3),('Cartão de Crédito',4),('Link de Pagamento',5),('Transferência Bancária',6)) AS v(name, ord)
ON CONFLICT DO NOTHING;

-- 4. EXPENSE CATEGORIES
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense_categories_member" ON public.expense_categories FOR ALL TO authenticated
  USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER trg_expense_categories_touch BEFORE UPDATE ON public.expense_categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.expense_categories (company_id, name)
SELECT c.id, v.name
FROM public.companies c
CROSS JOIN (VALUES ('Internet'),('Alimentação'),('Aluguel'),('Brindes'),('Combustível'),('Contabilidade'),('Marketing'),('Energia elétrica'),('Água'),('Impostos'),('Outros')) AS v(name)
ON CONFLICT DO NOTHING;

-- 5. SALES
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  subtotal_cents integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  surcharge_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  services_cents integer NOT NULL DEFAULT 0,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_member" ON public.sales FOR ALL TO authenticated
  USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER trg_sales_touch BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX IF NOT EXISTS sales_company_date_idx ON public.sales(company_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'product',
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  unit_cost numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sale_items_member" ON public.sale_items FOR ALL TO authenticated
  USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

CREATE TABLE IF NOT EXISTS public.sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  payment_option_id uuid REFERENCES public.payment_options(id) ON DELETE SET NULL,
  method_name text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  installments integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_payments TO authenticated;
GRANT ALL ON public.sale_payments TO service_role;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sale_payments_member" ON public.sale_payments FOR ALL TO authenticated
  USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

-- 6. APPOINTMENT PRODUCTS
CREATE TABLE IF NOT EXISTS public.appointment_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_products TO authenticated;
GRANT ALL ON public.appointment_products TO service_role;
ALTER TABLE public.appointment_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointment_products_member" ON public.appointment_products FOR ALL TO authenticated
  USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

-- 7. AUDIT
CREATE TABLE IF NOT EXISTS public.commerce_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  description text,
  old_data jsonb,
  new_data jsonb,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.commerce_audit_log TO authenticated;
GRANT ALL ON public.commerce_audit_log TO service_role;
ALTER TABLE public.commerce_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commerce_audit_select" ON public.commerce_audit_log FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "commerce_audit_insert" ON public.commerce_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id));

CREATE OR REPLACE FUNCTION public.audit_commerce()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE comp uuid; act text;
BEGIN
  IF TG_OP = 'DELETE' THEN comp := OLD.company_id; act := 'deleted';
  ELSIF TG_OP = 'INSERT' THEN comp := NEW.company_id; act := 'created';
  ELSE comp := NEW.company_id; act := 'updated'; END IF;

  INSERT INTO public.commerce_audit_log (company_id, entity, entity_id, action, old_data, new_data, actor_user_id)
  VALUES (comp, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), act,
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
          CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
          auth.uid());
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_audit_products AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.audit_commerce();
CREATE TRIGGER trg_audit_sales AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.audit_commerce();
CREATE TRIGGER trg_audit_inventory AFTER INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.audit_commerce();

-- 8. SALE FINALIZATION -> stock out + income
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.finalize_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it record; cust text;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;

  SELECT name INTO cust FROM public.customers WHERE id = NEW.customer_id;

  FOR it IN SELECT * FROM public.sale_items WHERE sale_id = NEW.id AND product_id IS NOT NULL LOOP
    INSERT INTO public.inventory_movements
      (company_id, product_id, type, quantity, unit_cost, reason, operation, sale_id, created_by)
    VALUES (NEW.company_id, it.product_id, 'out', it.quantity, it.unit_cost,
            'Venda #' || substr(NEW.id::text,1,8) || COALESCE(' · ' || cust, ''),
            'venda', NEW.id, NEW.created_by);
  END LOOP;

  IF NEW.total_cents > 0 THEN
    INSERT INTO public.financial_transactions
      (company_id, type, category, description, amount, occurred_on, sale_id, staff_id, appointment_id, created_by)
    VALUES (NEW.company_id, 'income', 'Produtos',
            'Venda #' || substr(NEW.id::text,1,8) || COALESCE(' · ' || cust, ''),
            NEW.total_cents / 100.0, (NEW.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date,
            NEW.id, NEW.staff_id, NEW.appointment_id, NEW.created_by);
  END IF;

  INSERT INTO public.commerce_audit_log (company_id, entity, entity_id, action, description, actor_user_id)
  VALUES (NEW.company_id, 'sale', NEW.id, 'sale_completed',
          'Venda finalizada · ' || to_char(NEW.total_cents/100.0, 'FM999G990D00'), auth.uid());

  RETURN NEW;
END $$;

CREATE TRIGGER trg_finalize_sale AFTER UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.finalize_sale();

-- 9. APPOINTMENT COMPLETED -> sale from appointment_products
CREATE OR REPLACE FUNCTION public.sell_appointment_products()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sale_id uuid; it record; sub integer := 0; disc integer := 0;
BEGIN
  IF NEW.status::text <> 'completed' OR OLD.status::text = 'completed' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.appointment_products WHERE appointment_id = NEW.id) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.sales WHERE appointment_id = NEW.id) THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(round(quantity * unit_price_cents))::int, 0), COALESCE(SUM(discount_cents),0)::int
    INTO sub, disc FROM public.appointment_products WHERE appointment_id = NEW.id;

  INSERT INTO public.sales (company_id, customer_id, staff_id, appointment_id, status,
                            subtotal_cents, discount_cents, total_cents, services_cents, occurred_at, created_by)
  VALUES (NEW.company_id, NEW.customer_id, NEW.staff_id, NEW.id, 'draft',
          sub, disc, GREATEST(0, sub - disc),
          GREATEST(0, COALESCE(NEW.total_cents,0) - COALESCE(NEW.discount_cents,0)), now(), auth.uid())
  RETURNING id INTO sale_id;

  FOR it IN SELECT ap.*, p.name, p.avg_cost FROM public.appointment_products ap
            JOIN public.products p ON p.id = ap.product_id
            WHERE ap.appointment_id = NEW.id LOOP
    INSERT INTO public.sale_items (company_id, sale_id, product_id, kind, name, quantity,
                                   unit_price_cents, discount_cents, total_cents, unit_cost)
    VALUES (NEW.company_id, sale_id, it.product_id, 'product', it.name, it.quantity,
            it.unit_price_cents, it.discount_cents,
            GREATEST(0, round(it.quantity * it.unit_price_cents)::int - it.discount_cents), it.avg_cost);
  END LOOP;

  UPDATE public.sales SET status = 'completed' WHERE id = sale_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sell_appointment_products AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.sell_appointment_products();

-- 10. Recreate missing existing triggers referenced by app logic is out of scope.

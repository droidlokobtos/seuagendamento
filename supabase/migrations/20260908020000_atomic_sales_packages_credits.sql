-- PDV confiável: pacotes vendáveis, consumo atômico de créditos e autoria.
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS created_by_name text;

ALTER TABLE public.plan_session_usage
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sale_item_id uuid REFERENCES public.sale_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversed_by uuid;

ALTER TABLE public.customer_plans
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.sale_credit_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  sale_item_id uuid NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
  customer_plan_id uuid NOT NULL REFERENCES public.customer_plans(id) ON DELETE RESTRICT,
  customer_plan_service_id uuid NOT NULL REFERENCES public.customer_plan_services(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  credit_cents integer NOT NULL CHECK (credit_cents >= 0),
  created_by uuid,
  reversed_at timestamptz,
  reversed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sale_credit_usages_sale_idx
  ON public.sale_credit_usages(sale_id);
CREATE INDEX IF NOT EXISTS sale_credit_usages_plan_idx
  ON public.sale_credit_usages(customer_plan_id, created_at DESC);

ALTER TABLE public.sale_credit_usages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.sale_credit_usages TO authenticated;
GRANT ALL ON public.sale_credit_usages TO service_role;

DROP POLICY IF EXISTS "sale credit usages read" ON public.sale_credit_usages;
CREATE POLICY "sale credit usages read"
ON public.sale_credit_usages FOR SELECT TO authenticated
USING (public.has_any_permission(company_id, ARRAY['caixa','financeiro','servicos']));

CREATE OR REPLACE FUNCTION public.register_sale_with_credits(
  _company_id uuid,
  _customer_id uuid,
  _items jsonb,
  _payments jsonb DEFAULT '[]'::jsonb,
  _discount_cents integer DEFAULT 0,
  _surcharge_cents integer DEFAULT 0,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  actor_name text;
  sale_id uuid;
  sale_item_id uuid;
  item jsonb;
  payment jsonb;
  product_row public.products%ROWTYPE;
  service_row public.services%ROWTYPE;
  plan_row public.plans%ROWTYPE;
  balance_row record;
  plan_service_row record;
  created_customer_plan_id uuid;
  created_customer_plan_ids uuid[] := ARRAY[]::uuid[];
  item_kind text;
  item_name text;
  item_id uuid;
  qty numeric;
  qty_integer integer;
  unit_price integer;
  manual_discount integer;
  credited_qty integer;
  take_qty integer;
  credit_value integer;
  line_total integer;
  subtotal integer := 0;
  item_discounts integer := 0;
  package_credits integer := 0;
  service_total integer := 0;
  total integer := 0;
  payment_total integer := 0;
  payment_option uuid;
  first_payment_method text;
  customer_name text;
  package_number integer;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT NULLIF(trim(full_name), '') INTO actor_name
  FROM public.profiles WHERE id = actor_id;
  actor_name := COALESCE(actor_name, 'Administrador');
  IF NOT (
    public.is_company_admin(_company_id)
    OR public.has_any_permission(_company_id, ARRAY['caixa'])
  ) THEN
    RAISE EXCEPTION 'Acesso negado para registrar vendas';
  END IF;
  IF jsonb_typeof(COALESCE(_items, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(_items, '[]'::jsonb)) = 0
     OR jsonb_array_length(_items) > 100 THEN
    RAISE EXCEPTION 'Informe de 1 a 100 itens válidos';
  END IF;
  IF jsonb_typeof(COALESCE(_payments, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Pagamentos inválidos';
  END IF;
  IF COALESCE(_discount_cents, 0) < 0 OR COALESCE(_surcharge_cents, 0) < 0 THEN
    RAISE EXCEPTION 'Desconto ou acréscimo inválido';
  END IF;

  IF _customer_id IS NOT NULL THEN
    SELECT name INTO customer_name
    FROM public.customers
    WHERE id = _customer_id AND company_id = _company_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não pertence a esta empresa'; END IF;
  END IF;

  INSERT INTO public.sales(
    company_id, customer_id, status, subtotal_cents, discount_cents,
    surcharge_cents, total_cents, services_cents, notes, created_by, created_by_name
  ) VALUES (
    _company_id, _customer_id, 'draft', 0, 0,
    COALESCE(_surcharge_cents, 0), 0, 0, NULLIF(trim(COALESCE(_notes, '')), ''), actor_id, actor_name
  ) RETURNING id INTO sale_id;

  FOR item IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    item_kind := lower(COALESCE(item->>'kind', ''));
    qty := COALESCE((item->>'quantity')::numeric, 0);
    manual_discount := GREATEST(0, COALESCE((item->>'discount_cents')::integer, 0));
    IF qty <= 0 THEN RAISE EXCEPTION 'A quantidade deve ser maior que zero'; END IF;

    IF item_kind = 'product' THEN
      item_id := (item->>'product_id')::uuid;
      SELECT * INTO product_row FROM public.products
      WHERE id = item_id AND company_id = _company_id AND active AND scope = 'sale'
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Produto inválido ou inativo'; END IF;
      IF COALESCE(product_row.stock_qty, 0) < qty THEN
        RAISE EXCEPTION 'Estoque insuficiente para %', product_row.name;
      END IF;
      item_name := product_row.name;
      unit_price := GREATEST(0, COALESCE(
        NULLIF((item->>'unit_price_cents')::integer, 0),
        round((CASE WHEN COALESCE(product_row.promo_price, 0) > 0
          THEN product_row.promo_price ELSE product_row.sale_price END) * 100)::integer
      ));
      line_total := GREATEST(0, round(qty * unit_price)::integer - manual_discount);
      INSERT INTO public.sale_items(
        company_id, sale_id, product_id, kind, name, quantity,
        unit_price_cents, discount_cents, total_cents, unit_cost
      ) VALUES (
        _company_id, sale_id, item_id, 'product', item_name, qty,
        unit_price, manual_discount, line_total, COALESCE(product_row.avg_cost, product_row.cost_price, 0)
      );

    ELSIF item_kind = 'service' THEN
      IF qty <> trunc(qty) THEN RAISE EXCEPTION 'Serviços devem usar quantidade inteira'; END IF;
      qty_integer := qty::integer;
      item_id := (item->>'service_id')::uuid;
      SELECT * INTO service_row FROM public.services
      WHERE id = item_id AND company_id = _company_id AND active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Serviço inválido ou inativo'; END IF;
      item_name := service_row.name;
      unit_price := GREATEST(0, COALESCE(NULLIF((item->>'unit_price_cents')::integer, 0), service_row.price_cents, 0));

      INSERT INTO public.sale_items(
        company_id, sale_id, service_id, kind, name, quantity,
        unit_price_cents, discount_cents, total_cents, unit_cost
      ) VALUES (
        _company_id, sale_id, item_id, 'service', item_name, qty_integer,
        unit_price, manual_discount, 0, 0
      ) RETURNING id INTO sale_item_id;

      credited_qty := 0;
      IF _customer_id IS NOT NULL THEN
        FOR balance_row IN
          SELECT cps.id, cps.customer_plan_id,
                 (cps.sessions_total - cps.sessions_used)::integer AS available
          FROM public.customer_plan_services cps
          JOIN public.customer_plans cp ON cp.id = cps.customer_plan_id
          WHERE cps.company_id = _company_id
            AND cps.service_id = item_id
            AND cp.customer_id = _customer_id
            AND cp.status = 'active'
            AND (cp.expires_at IS NULL OR cp.expires_at >= CURRENT_DATE)
            AND cps.sessions_used < cps.sessions_total
          ORDER BY cp.expires_at NULLS LAST, cp.sold_at, cps.created_at
          FOR UPDATE OF cps
        LOOP
          EXIT WHEN credited_qty >= qty_integer;
          take_qty := LEAST(balance_row.available, qty_integer - credited_qty);
          IF take_qty <= 0 THEN CONTINUE; END IF;
          credit_value := take_qty * unit_price;
          UPDATE public.customer_plan_services
          SET sessions_used = sessions_used + take_qty
          WHERE id = balance_row.id;

          INSERT INTO public.sale_credit_usages(
            company_id, sale_id, sale_item_id, customer_plan_id,
            customer_plan_service_id, service_id, quantity, credit_cents, created_by
          ) VALUES (
            _company_id, sale_id, sale_item_id, balance_row.customer_plan_id,
            balance_row.id, item_id, take_qty, credit_value, actor_id
          );
          INSERT INTO public.plan_session_usage(
            company_id, customer_plan_id, customer_id, service_id, service_name,
            sale_id, sale_item_id, quantity, actor_user_id, notes
          ) VALUES (
            _company_id, balance_row.customer_plan_id, _customer_id, item_id, item_name,
            sale_id, sale_item_id, take_qty, actor_id, 'Crédito consumido no PDV'
          );
          INSERT INTO public.plan_audit_log(
            company_id, entity, entity_id, action, description, new_data, actor_user_id
          ) VALUES (
            _company_id, 'session', balance_row.customer_plan_id, 'session_used',
            'Crédito utilizado no PDV: ' || item_name,
            jsonb_build_object('sale_id', sale_id, 'quantity', take_qty), actor_id
          );
          credited_qty := credited_qty + take_qty;
        END LOOP;
      END IF;

      credit_value := credited_qty * unit_price;
      package_credits := package_credits + credit_value;
      line_total := GREATEST(0, (qty_integer * unit_price) - credit_value - manual_discount);
      UPDATE public.sale_items
      SET discount_cents = manual_discount + credit_value, total_cents = line_total
      WHERE id = sale_item_id;
      service_total := service_total + line_total;

    ELSIF item_kind = 'package' THEN
      IF _customer_id IS NULL THEN RAISE EXCEPTION 'Selecione um cliente para vender um pacote'; END IF;
      IF qty <> trunc(qty) THEN RAISE EXCEPTION 'Pacotes devem usar quantidade inteira'; END IF;
      qty_integer := qty::integer;
      item_id := (item->>'plan_id')::uuid;
      SELECT * INTO plan_row FROM public.plans
      WHERE id = item_id AND company_id = _company_id AND active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Plano ou pacote inválido/inativo'; END IF;
      item_name := plan_row.name;
      unit_price := GREATEST(0, COALESCE(
        NULLIF((item->>'unit_price_cents')::integer, 0),
        CASE WHEN COALESCE(plan_row.promo_price_cents, 0) > 0
          THEN plan_row.promo_price_cents ELSE plan_row.price_cents END,
        0
      ));
      line_total := GREATEST(0, qty_integer * unit_price - manual_discount);

      INSERT INTO public.sale_items(
        company_id, sale_id, plan_id, kind, name, quantity,
        unit_price_cents, discount_cents, total_cents, unit_cost
      ) VALUES (
        _company_id, sale_id, item_id, 'package', item_name, qty_integer,
        unit_price, manual_discount, line_total, 0
      );

      FOR package_number IN 1..qty_integer
      LOOP
        INSERT INTO public.customer_plans(
          company_id, customer_id, plan_id, plan_name, kind, amount_cents, sale_id,
          payment_method, sold_by, expires_at, waive_deposit, notes
        ) VALUES (
          _company_id, _customer_id, plan_row.id, plan_row.name, plan_row.kind, unit_price, sale_id,
          NULL, actor_id,
          CASE
            WHEN plan_row.duration_days IS NOT NULL THEN CURRENT_DATE + plan_row.duration_days
            ELSE plan_row.valid_until
          END,
          plan_row.waive_deposit, 'Adquirido na venda #' || substr(sale_id::text, 1, 8)
        ) RETURNING id INTO created_customer_plan_id;
        created_customer_plan_ids := array_append(created_customer_plan_ids, created_customer_plan_id);

        FOR plan_service_row IN
          SELECT ps.service_id, ps.sessions, ps.notes, s.name AS service_name
          FROM public.plan_services ps
          JOIN public.services s ON s.id = ps.service_id
          WHERE ps.plan_id = plan_row.id
        LOOP
          INSERT INTO public.customer_plan_services(
            customer_plan_id, company_id, service_id, service_name,
            sessions_total, sessions_used, notes
          ) VALUES (
            created_customer_plan_id, _company_id, plan_service_row.service_id,
            plan_service_row.service_name, plan_service_row.sessions, 0, plan_service_row.notes
          );
        END LOOP;
      END LOOP;
    ELSE
      RAISE EXCEPTION 'Tipo de item inválido';
    END IF;

    subtotal := subtotal + round(qty * unit_price)::integer;
    item_discounts := item_discounts + (round(qty * unit_price)::integer - line_total);
  END LOOP;

  total := GREATEST(0, subtotal - item_discounts - COALESCE(_discount_cents, 0) + COALESCE(_surcharge_cents, 0));

  FOR payment IN SELECT value FROM jsonb_array_elements(COALESCE(_payments, '[]'::jsonb))
  LOOP
    IF COALESCE((payment->>'amount_cents')::integer, 0) <= 0 THEN CONTINUE; END IF;
    payment_option := NULLIF(payment->>'payment_option_id', '')::uuid;
    IF payment_option IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.payment_options
      WHERE id = payment_option AND company_id = _company_id AND active
    ) THEN
      RAISE EXCEPTION 'Forma de pagamento inválida';
    END IF;
    INSERT INTO public.sale_payments(
      company_id, sale_id, payment_option_id, method_name, amount_cents, installments
    ) VALUES (
      _company_id, sale_id, payment_option,
      COALESCE(NULLIF(trim(payment->>'method_name'), ''), 'Outro'),
      (payment->>'amount_cents')::integer,
      GREATEST(1, COALESCE((payment->>'installments')::integer, 1))
    );
    first_payment_method := COALESCE(
      first_payment_method,
      NULLIF(trim(payment->>'method_name'), ''),
      'Outro'
    );
    payment_total := payment_total + (payment->>'amount_cents')::integer;
  END LOOP;

  IF payment_total <> total THEN
    RAISE EXCEPTION 'O pagamento deve corresponder ao total da venda (%)',
      to_char(total / 100.0, 'FM999G990D00');
  END IF;

  IF first_payment_method IS NOT NULL AND cardinality(created_customer_plan_ids) > 0 THEN
    UPDATE public.customer_plans
    SET payment_method = first_payment_method
    WHERE id = ANY(created_customer_plan_ids);
  END IF;

  UPDATE public.sales
  SET subtotal_cents = subtotal,
      discount_cents = item_discounts + COALESCE(_discount_cents, 0),
      surcharge_cents = COALESCE(_surcharge_cents, 0),
      total_cents = total,
      services_cents = service_total,
      status = 'completed'
  WHERE id = sale_id;

  INSERT INTO public.commerce_audit_log(
    company_id, entity, entity_id, action, description, new_data, actor_user_id
  ) VALUES (
    _company_id, 'sale', sale_id, 'sale_registered',
    'Venda registrada por usuário autenticado' || COALESCE(' · ' || customer_name, ''),
    jsonb_build_object(
      'subtotal_cents', subtotal,
      'credits_cents', package_credits,
      'discount_cents', COALESCE(_discount_cents, 0),
      'surcharge_cents', COALESCE(_surcharge_cents, 0),
      'total_cents', total
    ),
    actor_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'sale_id', sale_id,
    'subtotal_cents', subtotal,
    'credits_cents', package_credits,
    'total_cents', total,
    'created_by', actor_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_sale_with_credits(uuid,uuid,jsonb,jsonb,integer,integer,text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_sale_with_credits(uuid,uuid,jsonb,jsonb,integer,integer,text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_sale_with_reversal(
  _sale_id uuid,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  sale_row public.sales%ROWTYPE;
  item_row record;
  credit_row record;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO sale_row FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
  IF NOT (
    public.is_company_admin(sale_row.company_id)
    OR public.has_any_permission(sale_row.company_id, ARRAY['caixa'])
  ) THEN
    RAISE EXCEPTION 'Acesso negado para cancelar vendas';
  END IF;
  IF sale_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'already_cancelled', true, 'sale_id', _sale_id);
  END IF;
  IF sale_row.status <> 'completed' THEN RAISE EXCEPTION 'Somente vendas concluídas podem ser canceladas'; END IF;

  FOR item_row IN
    SELECT * FROM public.sale_items
    WHERE sale_id = _sale_id AND product_id IS NOT NULL
  LOOP
    INSERT INTO public.inventory_movements(
      company_id, product_id, type, quantity, unit_cost, reason, operation, sale_id, created_by
    ) VALUES (
      sale_row.company_id, item_row.product_id, 'in', item_row.quantity, item_row.unit_cost,
      'Estorno da venda #' || substr(_sale_id::text, 1, 8), 'estorno', _sale_id, actor_id
    );
  END LOOP;

  FOR credit_row IN
    SELECT * FROM public.sale_credit_usages
    WHERE sale_id = _sale_id AND reversed_at IS NULL
    FOR UPDATE
  LOOP
    UPDATE public.customer_plan_services
    SET sessions_used = GREATEST(0, sessions_used - credit_row.quantity)
    WHERE id = credit_row.customer_plan_service_id;

    UPDATE public.sale_credit_usages
    SET reversed_at = now(), reversed_by = actor_id
    WHERE id = credit_row.id;

    INSERT INTO public.plan_audit_log(
      company_id, entity, entity_id, action, description, new_data, actor_user_id
    ) VALUES (
      sale_row.company_id, 'session', credit_row.customer_plan_id, 'session_reversed',
      'Crédito devolvido pelo cancelamento da venda',
      jsonb_build_object('sale_id', _sale_id, 'quantity', credit_row.quantity), actor_id
    );
  END LOOP;

  UPDATE public.plan_session_usage
  SET reversed_at = now(), reversed_by = actor_id
  WHERE sale_id = _sale_id AND reversed_at IS NULL;

  IF EXISTS (
    SELECT 1
    FROM public.customer_plans cp
    JOIN public.customer_plan_services cps ON cps.customer_plan_id = cp.id
    WHERE cp.sale_id = _sale_id AND cps.sessions_used > 0
  ) THEN
    RAISE EXCEPTION 'Este pacote já possui sessões utilizadas e exige ajuste administrativo antes do cancelamento';
  END IF;

  UPDATE public.customer_plans
  SET status = 'cancelled', cancelled_at = now(),
      cancel_reason = COALESCE(NULLIF(trim(_reason), ''), 'Venda cancelada')
  WHERE sale_id = _sale_id AND status = 'active';

  IF sale_row.total_cents > 0 AND sale_row.appointment_id IS NULL THEN
    INSERT INTO public.financial_transactions(
      company_id, type, category, description, amount, occurred_on, sale_id, staff_id, created_by
    ) VALUES (
      sale_row.company_id, 'expense', 'Estorno de venda',
      'Estorno da venda #' || substr(_sale_id::text, 1, 8), sale_row.total_cents / 100.0,
      (now() AT TIME ZONE 'America/Sao_Paulo')::date, _sale_id, sale_row.staff_id, actor_id
    );
  END IF;

  UPDATE public.sales
  SET status = 'cancelled',
      notes = concat_ws(' · ', NULLIF(notes, ''),
        'Cancelada: ' || COALESCE(NULLIF(trim(_reason), ''), 'sem motivo informado'))
  WHERE id = _sale_id;

  INSERT INTO public.commerce_audit_log(
    company_id, entity, entity_id, action, description, actor_user_id
  ) VALUES (
    sale_row.company_id, 'sale', _sale_id, 'sale_cancelled_reversed',
    COALESCE(NULLIF(trim(_reason), ''), 'Venda cancelada com estorno automático'), actor_id
  );

  RETURN jsonb_build_object('ok', true, 'sale_id', _sale_id, 'reversed_by', actor_id);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_sale_with_reversal(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_sale_with_reversal(uuid,text) TO authenticated;

NOTIFY pgrst, 'reload schema';

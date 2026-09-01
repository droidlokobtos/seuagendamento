-- Checkout unificado: serviço agendado + produtos vendidos no mesmo pagamento.
-- A venda de produto continua registrada e vinculada ao cliente/agendamento,
-- mas o recebimento financeiro é contabilizado pelo pagamento do agendamento,
-- evitando dupla receita.

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

  -- Vendas avulsas entram no financeiro pela própria venda.
  -- Vendas vinculadas a atendimento entram no financeiro pelo appointment_payment,
  -- que contém serviço + produtos no mesmo recebimento.
  IF NEW.total_cents > 0 AND NEW.appointment_id IS NULL THEN
    INSERT INTO public.financial_transactions
      (company_id, type, category, description, amount, occurred_on, sale_id, staff_id, appointment_id, created_by)
    VALUES (NEW.company_id, 'income', 'Produtos',
            'Venda #' || substr(NEW.id::text,1,8) || COALESCE(' · ' || cust, ''),
            NEW.total_cents / 100.0, (NEW.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date,
            NEW.id, NEW.staff_id, NEW.appointment_id, NEW.created_by);
  END IF;

  INSERT INTO public.commerce_audit_log (company_id, entity, entity_id, action, description, actor_user_id)
  VALUES (NEW.company_id, 'sale', NEW.id, 'sale_completed',
          CASE WHEN NEW.appointment_id IS NULL THEN 'Venda avulsa finalizada · ' ELSE 'Venda vinculada ao atendimento finalizada · ' END ||
          to_char(NEW.total_cents/100.0, 'FM999G990D00'), auth.uid());

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.checkout_appointment_with_products(
  _appointment_id uuid,
  _products jsonb,
  _payment_kind text,
  _payment_amount_cents integer,
  _payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  appt record;
  item jsonb;
  prod record;
  qty numeric;
  unit_cents integer;
  line_total integer;
  products_total integer := 0;
  sale_id uuid;
  payment_id uuid;
  new_total integer;
  approved_paid integer;
  new_balance integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id, company_id, customer_id, staff_id, total_cents, discount_cents, surcharge_cents
    INTO appt
  FROM public.appointments
  WHERE id = _appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado'; END IF;
  IF NOT public.is_company_member(appt.company_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF _payment_amount_cents <= 0 THEN RAISE EXCEPTION 'Valor do pagamento inválido'; END IF;
  IF _payment_kind NOT IN ('deposit','final','extra','refund') THEN RAISE EXCEPTION 'Tipo de pagamento inválido'; END IF;
  IF COALESCE(trim(_payment_method), '') = '' THEN RAISE EXCEPTION 'Forma de pagamento obrigatória'; END IF;

  IF jsonb_typeof(COALESCE(_products, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Produtos inválidos';
  END IF;

  IF jsonb_array_length(COALESCE(_products, '[]'::jsonb)) > 0 THEN
    INSERT INTO public.sales (
      company_id, customer_id, staff_id, appointment_id, status,
      subtotal_cents, discount_cents, surcharge_cents, total_cents,
      services_cents, notes, occurred_at, created_by
    ) VALUES (
      appt.company_id, appt.customer_id, appt.staff_id, appt.id, 'draft',
      0, 0, 0, 0, 0,
      'Produtos adicionados no fechamento do atendimento', now(), auth.uid()
    ) RETURNING id INTO sale_id;

    FOR item IN SELECT * FROM jsonb_array_elements(_products)
    LOOP
      qty := GREATEST(0, COALESCE((item->>'quantity')::numeric, 0));
      IF qty <= 0 THEN CONTINUE; END IF;

      SELECT id, name, stock_qty, avg_cost, sale_price, promo_price, active, scope
        INTO prod
      FROM public.products
      WHERE id = (item->>'product_id')::uuid
        AND company_id = appt.company_id
      FOR UPDATE;

      IF NOT FOUND OR NOT prod.active OR prod.scope <> 'sale' THEN
        RAISE EXCEPTION 'Produto inválido ou indisponível';
      END IF;
      IF COALESCE(prod.stock_qty, 0) < qty THEN
        RAISE EXCEPTION 'Estoque insuficiente para %', prod.name;
      END IF;

      unit_cents := round((CASE WHEN COALESCE(prod.promo_price, 0) > 0 THEN prod.promo_price ELSE prod.sale_price END) * 100)::int;
      line_total := round(qty * unit_cents)::int;
      products_total := products_total + line_total;

      INSERT INTO public.sale_items (
        company_id, sale_id, product_id, kind, name, quantity,
        unit_price_cents, discount_cents, total_cents, unit_cost
      ) VALUES (
        appt.company_id, sale_id, prod.id, 'product', prod.name, qty,
        unit_cents, 0, line_total, prod.avg_cost
      );
    END LOOP;

    IF products_total <= 0 THEN
      DELETE FROM public.sales WHERE id = sale_id;
      sale_id := NULL;
    ELSE
      UPDATE public.sales
      SET subtotal_cents = products_total,
          total_cents = products_total
      WHERE id = sale_id;

      UPDATE public.appointments
      SET total_cents = COALESCE(total_cents, 0) + products_total
      WHERE id = appt.id;
    END IF;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN kind = 'refund' THEN -amount_cents ELSE amount_cents END), 0)::int
    INTO approved_paid
  FROM public.appointment_payments
  WHERE appointment_id = appt.id AND status = 'approved';

  SELECT GREATEST(0, COALESCE(total_cents, 0) - COALESCE(discount_cents, 0) + COALESCE(surcharge_cents, 0) - approved_paid)
    INTO new_balance
  FROM public.appointments WHERE id = appt.id;

  IF _payment_kind NOT IN ('extra','refund') AND _payment_amount_cents > new_balance THEN
    RAISE EXCEPTION 'O pagamento não pode ser maior que o saldo do atendimento';
  END IF;

  INSERT INTO public.appointment_payments (
    company_id, appointment_id, kind, amount_cents, method, status,
    created_by, reviewed_by, reviewed_at
  ) VALUES (
    appt.company_id, appt.id, _payment_kind, _payment_amount_cents, _payment_method, 'approved',
    auth.uid(), auth.uid(), now()
  ) RETURNING id INTO payment_id;

  IF sale_id IS NOT NULL THEN
    UPDATE public.sales SET status = 'completed' WHERE id = sale_id;
  END IF;

  SELECT COALESCE(total_cents, 0) INTO new_total FROM public.appointments WHERE id = appt.id;

  RETURN jsonb_build_object(
    'ok', true,
    'appointment_id', appt.id,
    'sale_id', sale_id,
    'payment_id', payment_id,
    'products_total_cents', products_total,
    'appointment_total_cents', new_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_appointment_with_products(uuid,jsonb,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkout_appointment_with_products(uuid,jsonb,text,integer,text) TO authenticated;

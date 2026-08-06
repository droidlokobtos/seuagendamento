-- 1. Índices únicos ausentes (causa raiz do erro ao finalizar)
CREATE UNIQUE INDEX IF NOT EXISTS commissions_appt_service_staff_uidx
  ON public.commissions (appointment_id, service_id, staff_id);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_events_appt_event_uidx
  ON public.attendance_events (appointment_id, event);
CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_appt_payment_uidx
  ON public.financial_transactions (appointment_payment_id) WHERE appointment_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS plan_session_usage_uidx
  ON public.plan_session_usage (customer_plan_id, appointment_id, service_id);

-- 2. Data/hora de conclusão
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_appointment_completed()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status::text = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  IF NEW.status::text <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  IF NEW.ends_at IS NULL AND NEW.starts_at IS NOT NULL THEN
    NEW.ends_at := NEW.starts_at + interval '30 minutes';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_stamp_appointment_completed ON public.appointments;
CREATE TRIGGER trg_stamp_appointment_completed
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.stamp_appointment_completed();

-- 3. Anti-duplicidade de horários por profissional (proteção contra concorrência)
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_overlap;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    company_id WITH =,
    staff_id WITH =,
    tstzrange(starts_at, COALESCE(ends_at, starts_at), '[)') WITH &&
  )
  WHERE (
    staff_id IS NOT NULL
    AND status NOT IN ('cancelled'::public.appointment_status,
                       'cancelled_by_customer'::public.appointment_status,
                       'cancelled_by_company'::public.appointment_status,
                       'no_show'::public.appointment_status)
  );

-- 4. Etapas acessórias tolerantes a falha
CREATE OR REPLACE FUNCTION public.consume_procedure_supplies()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  it record; stf_name text; cust_name text; low_cnt integer; total_cost numeric := 0;
BEGIN
  IF NEW.status::text <> 'completed' OR OLD.status::text = 'completed' THEN
    RETURN NEW;
  END IF;
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.financial_audit_log (company_id, appointment_id, action, description, amount_cents, actor_user_id)
    VALUES (NEW.company_id, NEW.id, 'procedure_cost_failed', 'Falha ao baixar insumos: ' || SQLERRM, 0, auth.uid());
  END;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.consume_plan_sessions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  svc record; bal record; stf_name text;
BEGIN
  IF NEW.status::text <> 'completed' OR OLD.status::text = 'completed' OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;
  BEGIN
    SELECT name INTO stf_name FROM public.staff WHERE id = NEW.staff_id;
    FOR svc IN
      SELECT aps.service_id, s.name AS service_name
      FROM public.appointment_services aps
      JOIN public.services s ON s.id = aps.service_id
      WHERE aps.appointment_id = NEW.id
    LOOP
      SELECT cps.* INTO bal
      FROM public.customer_plan_services cps
      JOIN public.customer_plans cp ON cp.id = cps.customer_plan_id
      WHERE cps.service_id = svc.service_id
        AND cp.customer_id = NEW.customer_id
        AND cp.company_id = NEW.company_id
        AND cp.status = 'active'
        AND (cp.expires_at IS NULL OR cp.expires_at >= CURRENT_DATE)
        AND cps.sessions_used < cps.sessions_total
      ORDER BY cp.expires_at NULLS LAST, cp.sold_at
      LIMIT 1;
      IF NOT FOUND THEN CONTINUE; END IF;

      UPDATE public.customer_plan_services SET sessions_used = sessions_used + 1 WHERE id = bal.id;

      INSERT INTO public.plan_session_usage (
        company_id, customer_plan_id, customer_id, service_id, service_name,
        appointment_id, staff_id, staff_name, quantity, actor_user_id
      ) VALUES (
        NEW.company_id, bal.customer_plan_id, NEW.customer_id, svc.service_id, svc.service_name,
        NEW.id, NEW.staff_id, stf_name, 1, auth.uid()
      ) ON CONFLICT (customer_plan_id, appointment_id, service_id) DO NOTHING;

      INSERT INTO public.plan_audit_log (company_id, entity, entity_id, action, description, actor_user_id)
      VALUES (NEW.company_id, 'session', bal.customer_plan_id, 'session_used',
              'Sessão consumida: ' || svc.service_name, auth.uid());
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.generate_review_invite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE days integer; tok text;
BEGIN
  IF NEW.status::text <> 'completed' OR OLD.status::text = 'completed' THEN RETURN NEW; END IF;
  BEGIN
    SELECT COALESCE(rs.expiration_days, ps.review_expiration_days, 30) INTO days
    FROM (SELECT 1) x
    LEFT JOIN public.review_settings rs ON rs.company_id = NEW.company_id
    LEFT JOIN public.platform_settings ps ON ps.id = true;
    days := COALESCE(days, 30);
    tok := upper(encode(gen_random_bytes(6), 'hex'));
    INSERT INTO public.review_invites (company_id, appointment_id, customer_id, staff_id, token, status, expires_at)
    VALUES (NEW.company_id, NEW.id, NEW.customer_id, NEW.staff_id, tok, 'pending', now() + (days || ' days')::interval)
    ON CONFLICT (appointment_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.enqueue_review_request()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.status::text = 'completed' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    BEGIN
      INSERT INTO public.appointment_reminders (appointment_id, company_id, kind, scheduled_for)
      VALUES (NEW.id, NEW.company_id, 'review', COALESCE(NEW.ends_at, NEW.starts_at) + interval '2 hours')
      ON CONFLICT (appointment_id, kind) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.sell_appointment_products()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE sale_id uuid; it record; sub integer := 0; disc integer := 0;
BEGIN
  IF NEW.status::text <> 'completed' OR OLD.status::text = 'completed' THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.appointment_products WHERE appointment_id = NEW.id) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.sales WHERE appointment_id = NEW.id) THEN RETURN NEW; END IF;
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RETURN NEW;
END; $function$;

-- 5. Catálogo de planos
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  monthly_cents integer NOT NULL DEFAULT 0,
  cycle_months integer,
  cycle_total_cents integer,
  discount_percent numeric DEFAULT 0,
  max_users integer,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  selectable boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Planos visíveis a usuários autenticados" ON public.subscription_plans;
CREATE POLICY "Planos visíveis a usuários autenticados" ON public.subscription_plans
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Somente admin master gerencia planos" ON public.subscription_plans;
CREATE POLICY "Somente admin master gerencia planos" ON public.subscription_plans
  FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP TRIGGER IF EXISTS trg_subscription_plans_touch ON public.subscription_plans;
CREATE TRIGGER trg_subscription_plans_touch BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.subscription_plans (code, name, description, monthly_cents, cycle_months, cycle_total_cents, discount_percent, max_users, selectable, sort_order, features)
VALUES
 ('basic','Básico','Recursos essenciais para começar', 4990, 1, 4990, 0, 3, true, 1,
   '{"dashboard":true,"agenda":true,"agendamentos":true,"clientes":true,"servicos":true,"produtos":true,"caixa":true,"relatorios":true,"portal":true}'::jsonb),
 ('business','Business','Gestão completa do salão', 6990, 6, 39843, 5, NULL, true, 2,
   '{"dashboard":true,"agenda":true,"agendamentos":true,"clientes":true,"servicos":true,"produtos":true,"caixa":true,"relatorios":true,"portal":true,"financeiro":true,"comissoes":true,"estoque":true,"auditoria":true,"relatorios_avancados":true,"personalizacao":true,"fluxo_caixa":true,"metas":true,"suporte_prioritario":true}'::jsonb),
 ('pro','Pro','Todos os recursos atuais e futuros', 10990, 12, 125286, 5, NULL, true, 3,
   '{"all":true}'::jsonb),
 ('trial','Teste','Plano de avaliação criado pelo Admin Master', 0, NULL, 0, 0, NULL, false, 0,
   '{"all":true}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, monthly_cents = EXCLUDED.monthly_cents,
  cycle_months = EXCLUDED.cycle_months, cycle_total_cents = EXCLUDED.cycle_total_cents,
  discount_percent = EXCLUDED.discount_percent, max_users = EXCLUDED.max_users,
  selectable = EXCLUDED.selectable, sort_order = EXCLUDED.sort_order, features = EXCLUDED.features;

-- 6. Assinatura / teste na empresa
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan_code text REFERENCES public.subscription_plans(code),
  ADD COLUMN IF NOT EXISTS plan_cycle_months integer,
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trial_started_at date,
  ADD COLUMN IF NOT EXISTS trial_days integer,
  ADD COLUMN IF NOT EXISTS trial_ends_at date;

ALTER TYPE public.company_status ADD VALUE IF NOT EXISTS 'trial';
ALTER TYPE public.company_status ADD VALUE IF NOT EXISTS 'trial_expired';

-- 7. Reserva temporária na lista de espera
ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS reserved_until timestamptz,
  ADD COLUMN IF NOT EXISTS offered_at timestamptz,
  ADD COLUMN IF NOT EXISTS offered_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

ALTER TABLE public.attendance_settings
  ADD COLUMN IF NOT EXISTS waitlist_hold_minutes integer NOT NULL DEFAULT 30;

-- 8. Recursos por plano e bloqueio
CREATE OR REPLACE FUNCTION public.company_features(_company uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(sp.features, '{"all":true}'::jsonb)
  FROM public.companies c
  LEFT JOIN public.subscription_plans sp ON sp.code = c.plan_code
  WHERE c.id = _company;
$$;

CREATE OR REPLACE FUNCTION public.has_feature(_company uuid, _key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_super_admin() OR COALESCE(
    (public.company_features(_company) ->> 'all')::boolean,
    false
  ) OR COALESCE((public.company_features(_company) ->> _key)::boolean, false)
  OR public.company_features(_company) = '{}'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.is_company_blocked(_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = _company
      AND (
        c.suspended_at IS NOT NULL
        OR (c.is_trial AND c.trial_ends_at IS NOT NULL AND c.trial_ends_at < CURRENT_DATE)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.company_features(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_feature(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_blocked(uuid) TO authenticated;
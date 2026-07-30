-- ============ PLANS CATALOG ============
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'package' CHECK (kind IN ('plan','package')),
  price_cents integer NOT NULL DEFAULT 0,
  promo_price_cents integer,
  valid_until date,
  sessions_total integer,
  duration_days integer,
  image_url text,
  active boolean NOT NULL DEFAULT true,
  waive_deposit boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plans_company_idx ON public.plans(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_select_members" ON public.plans FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "plans_write_admin" ON public.plans FOR ALL TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE TRIGGER plans_touch BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PLAN SERVICES ============
CREATE TABLE public.plan_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  sessions integer NOT NULL DEFAULT 1 CHECK (sessions > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, service_id)
);
CREATE INDEX plan_services_plan_idx ON public.plan_services(plan_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_services TO authenticated;
GRANT ALL ON public.plan_services TO service_role;
ALTER TABLE public.plan_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_services_select_members" ON public.plan_services FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "plan_services_write_admin" ON public.plan_services FOR ALL TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));

-- ============ CUSTOMER PLANS (SALES) ============
CREATE TABLE public.customer_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  plan_name text NOT NULL,
  kind text NOT NULL DEFAULT 'package' CHECK (kind IN ('plan','package')),
  amount_cents integer NOT NULL DEFAULT 0,
  payment_method text,
  sold_at timestamptz NOT NULL DEFAULT now(),
  sold_by uuid,
  expires_at date,
  waive_deposit boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  cancelled_at timestamptz,
  cancel_reason text,
  renewed_from_id uuid REFERENCES public.customer_plans(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_plans_company_idx ON public.customer_plans(company_id);
CREATE INDEX customer_plans_customer_idx ON public.customer_plans(customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_plans TO authenticated;
GRANT ALL ON public.customer_plans TO service_role;
ALTER TABLE public.customer_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_plans_select_members" ON public.customer_plans FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "customer_plans_write_admin" ON public.customer_plans FOR ALL TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE TRIGGER customer_plans_touch BEFORE UPDATE ON public.customer_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CUSTOMER PLAN SERVICE BALANCES ============
CREATE TABLE public.customer_plan_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_plan_id uuid NOT NULL REFERENCES public.customer_plans(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  service_name text,
  sessions_total integer NOT NULL DEFAULT 1,
  sessions_used integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_plan_id, service_id)
);
CREATE INDEX customer_plan_services_plan_idx ON public.customer_plan_services(customer_plan_id);
CREATE INDEX customer_plan_services_service_idx ON public.customer_plan_services(service_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_plan_services TO authenticated;
GRANT ALL ON public.customer_plan_services TO service_role;
ALTER TABLE public.customer_plan_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cps_select_members" ON public.customer_plan_services FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "cps_write_admin" ON public.customer_plan_services FOR ALL TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE TRIGGER cps_touch BEFORE UPDATE ON public.customer_plan_services FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SESSION USAGE HISTORY (append-only) ============
CREATE TABLE public.plan_session_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_plan_id uuid NOT NULL REFERENCES public.customer_plans(id) ON DELETE CASCADE,
  customer_id uuid,
  service_id uuid,
  service_name text,
  appointment_id uuid,
  staff_id uuid,
  staff_name text,
  quantity integer NOT NULL DEFAULT 1,
  used_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX psu_company_idx ON public.plan_session_usage(company_id);
CREATE INDEX psu_plan_idx ON public.plan_session_usage(customer_plan_id);
CREATE UNIQUE INDEX psu_unique_appt_service ON public.plan_session_usage(appointment_id, service_id) WHERE appointment_id IS NOT NULL;
GRANT SELECT, INSERT ON public.plan_session_usage TO authenticated;
GRANT ALL ON public.plan_session_usage TO service_role;
ALTER TABLE public.plan_session_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "psu_select_members" ON public.plan_session_usage FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "psu_insert_members" ON public.plan_session_usage FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));

-- ============ AUDIT LOG (append-only) ============
CREATE TABLE public.plan_audit_log (
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
CREATE INDEX plan_audit_company_idx ON public.plan_audit_log(company_id, created_at DESC);
GRANT SELECT, INSERT ON public.plan_audit_log TO authenticated;
GRANT ALL ON public.plan_audit_log TO service_role;
ALTER TABLE public.plan_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_audit_select_members" ON public.plan_audit_log FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "plan_audit_insert_members" ON public.plan_audit_log FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));

-- ============ AUTO EXPIRE + CONSUMPTION HELPERS ============
CREATE OR REPLACE FUNCTION public.plan_mark_expired()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.customer_plans
     SET status = 'expired'
   WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < CURRENT_DATE;
$$;

-- Consome sessões do plano ativo quando um atendimento é concluído
CREATE OR REPLACE FUNCTION public.consume_plan_sessions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  svc record;
  bal record;
  stf_name text;
BEGIN
  IF NEW.status::text <> 'completed' OR OLD.status::text = 'completed' OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

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

    UPDATE public.customer_plan_services
       SET sessions_used = sessions_used + 1
     WHERE id = bal.id;

    INSERT INTO public.plan_session_usage (
      company_id, customer_plan_id, customer_id, service_id, service_name,
      appointment_id, staff_id, staff_name, quantity, actor_user_id
    ) VALUES (
      NEW.company_id, bal.customer_plan_id, NEW.customer_id, svc.service_id, svc.service_name,
      NEW.id, NEW.staff_id, stf_name, 1, auth.uid()
    ) ON CONFLICT DO NOTHING;

    INSERT INTO public.plan_audit_log (company_id, entity, entity_id, action, description, actor_user_id)
    VALUES (NEW.company_id, 'session', bal.customer_plan_id, 'session_used',
            'Sessão consumida: ' || svc.service_name, auth.uid());
  END LOOP;

  RETURN NEW;
END; $$;

CREATE TRIGGER appointments_consume_plan
AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.consume_plan_sessions();

-- 1. New appointment statuses (additive only)
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'reminder_sent';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'cancelled_by_customer';
ALTER TYPE public.appointment_status ADD VALUE IF NOT EXISTS 'cancelled_by_company';

-- 2. Commission rules on services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS has_commission boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS commission_value numeric(12,2) NOT NULL DEFAULT 0;

-- 3. Commissions ledger
CREATE TABLE IF NOT EXISTS public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  staff_name text,
  customer_name text,
  service_name text,
  service_amount_cents integer NOT NULL DEFAULT 0,
  commission_type text NOT NULL DEFAULT 'percent',
  commission_value numeric(12,2) NOT NULL DEFAULT 0,
  commission_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commissions_status_chk CHECK (status IN ('pending','paid','cancelled')),
  CONSTRAINT commissions_type_chk CHECK (commission_type IN ('fixed','percent'))
);
CREATE UNIQUE INDEX IF NOT EXISTS commissions_unique_appt_service
  ON public.commissions (appointment_id, service_id, staff_id)
  WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS commissions_company_date_idx ON public.commissions (company_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS commissions_staff_idx ON public.commissions (staff_id, occurred_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commissions TO authenticated;
GRANT ALL ON public.commissions TO service_role;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commissions admin read" ON public.commissions FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id));
CREATE POLICY "commissions own read" ON public.commissions FOR SELECT TO authenticated
  USING (staff_id IN (SELECT s.id FROM public.staff s WHERE s.user_id = auth.uid()));
CREATE POLICY "commissions admin write" ON public.commissions FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY "commissions admin update" ON public.commissions FOR UPDATE TO authenticated
  USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE POLICY "commissions admin delete" ON public.commissions FOR DELETE TO authenticated
  USING (public.is_company_admin(company_id));

CREATE TRIGGER commissions_touch BEFORE UPDATE ON public.commissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Appointment confirmations (tokens + delivery state)
CREATE TABLE IF NOT EXISTS public.appointment_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  channel text NOT NULL DEFAULT 'whatsapp',
  status text NOT NULL DEFAULT 'pending',
  message text,
  send_url text,
  sent_at timestamptz,
  last_sent_at timestamptz,
  send_attempts integer NOT NULL DEFAULT 0,
  responded_at timestamptz,
  response text,
  cancel_reason text,
  response_ip text,
  response_user_agent text,
  error text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appt_conf_status_chk CHECK (status IN ('pending','sent','failed','confirmed','cancelled','expired')),
  CONSTRAINT appt_conf_appointment_unique UNIQUE (appointment_id)
);
CREATE INDEX IF NOT EXISTS appt_conf_company_idx ON public.appointment_confirmations (company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_confirmations TO authenticated;
GRANT ALL ON public.appointment_confirmations TO service_role;
ALTER TABLE public.appointment_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appt conf member all" ON public.appointment_confirmations FOR ALL TO authenticated
  USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER appt_conf_touch BEFORE UPDATE ON public.appointment_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Messaging settings (future WhatsApp / SMS / Email providers)
CREATE TABLE IF NOT EXISTS public.messaging_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  auto_confirmation_enabled boolean NOT NULL DEFAULT true,
  reminder_hours integer NOT NULL DEFAULT 24,
  active_channels text[] NOT NULL DEFAULT ARRAY['whatsapp']::text[],
  whatsapp_provider text,
  whatsapp_api_url text,
  whatsapp_api_token text,
  whatsapp_instance text,
  whatsapp_sender text,
  sms_provider text,
  sms_api_url text,
  sms_api_token text,
  sms_sender text,
  email_provider text,
  email_api_url text,
  email_api_token text,
  email_from text,
  message_template text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messaging_settings TO authenticated;
GRANT ALL ON public.messaging_settings TO service_role;
ALTER TABLE public.messaging_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messaging settings admin all" ON public.messaging_settings FOR ALL TO authenticated
  USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE TRIGGER messaging_settings_touch BEFORE UPDATE ON public.messaging_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Messaging logs
CREATE TABLE IF NOT EXISTS public.messaging_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  confirmation_id uuid REFERENCES public.appointment_confirmations(id) ON DELETE SET NULL,
  channel text,
  event text NOT NULL,
  status text,
  detail text,
  actor_user_id uuid,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messaging_logs_company_idx ON public.messaging_logs (company_id, created_at DESC);
GRANT SELECT, INSERT ON public.messaging_logs TO authenticated;
GRANT ALL ON public.messaging_logs TO service_role;
ALTER TABLE public.messaging_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messaging logs member read" ON public.messaging_logs FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "messaging logs member insert" ON public.messaging_logs FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id));

-- 7. Automatic commission generation when an appointment is completed
CREATE OR REPLACE FUNCTION public.generate_appointment_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  rec record;
  cents integer;
  ctype text;
  cvalue numeric;
  total integer := 0;
  cust_name text;
  stf_name text;
BEGIN
  IF NEW.status::text <> 'completed' OR OLD.status::text = 'completed' THEN
    RETURN NEW;
  END IF;
  IF NEW.staff_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO stf_name FROM public.staff WHERE id = NEW.staff_id;
  SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;

  FOR rec IN
    SELECT aps.service_id, aps.price_cents, s.name AS service_name,
           s.has_commission, s.commission_type, s.commission_value
    FROM public.appointment_services aps
    JOIN public.services s ON s.id = aps.service_id
    WHERE aps.appointment_id = NEW.id
  LOOP
    ctype := NULL; cvalue := NULL; cents := 0;

    IF rec.has_commission THEN
      ctype := COALESCE(rec.commission_type, 'percent');
      cvalue := COALESCE(rec.commission_value, 0);
    ELSE
      SELECT 'percent', COALESCE(commission_pct, 0) INTO ctype, cvalue
      FROM public.staff WHERE id = NEW.staff_id;
    END IF;

    IF cvalue IS NULL OR cvalue <= 0 THEN
      CONTINUE;
    END IF;

    IF ctype = 'fixed' THEN
      cents := round(cvalue * 100)::int;
    ELSE
      cents := round(rec.price_cents * cvalue / 100.0)::int;
    END IF;

    IF cents <= 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.commissions (
      company_id, appointment_id, staff_id, customer_id, service_id,
      staff_name, customer_name, service_name,
      service_amount_cents, commission_type, commission_value, commission_cents,
      status, occurred_at
    ) VALUES (
      NEW.company_id, NEW.id, NEW.staff_id, NEW.customer_id, rec.service_id,
      stf_name, cust_name, rec.service_name,
      rec.price_cents, ctype, cvalue, cents,
      'pending', COALESCE(NEW.ends_at, NEW.starts_at, now())
    )
    ON CONFLICT (appointment_id, service_id, staff_id) DO NOTHING;

    total := total + cents;
  END LOOP;

  IF total > 0 THEN
    INSERT INTO public.financial_transactions (
      company_id, type, category, description, amount, occurred_on, appointment_id, staff_id
    ) VALUES (
      NEW.company_id, 'expense', 'Comissões',
      'Comissão de ' || COALESCE(stf_name, 'funcionário') || ' · agendamento #' || substr(NEW.id::text, 1, 8),
      (total / 100.0), CURRENT_DATE, NEW.id, NEW.staff_id
    );

    INSERT INTO public.notifications (company_id, kind, title, body, link, metadata)
    VALUES (
      NEW.company_id, 'commission_created', 'Comissão gerada',
      COALESCE(stf_name, 'Funcionário') || ' · ' || to_char(total / 100.0, 'FM999G990D00'),
      '/app/commissions',
      jsonb_build_object('appointment_id', NEW.id, 'staff_id', NEW.staff_id, 'total_cents', total)
    );
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_generate_commissions ON public.appointments;
CREATE TRIGGER trg_generate_commissions
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.generate_appointment_commissions();
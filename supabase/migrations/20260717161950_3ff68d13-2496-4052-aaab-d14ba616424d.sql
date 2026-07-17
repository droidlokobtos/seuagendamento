
-- ============================================
-- 1. ADMIN SECURITY: force password change + access logs
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.admin_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  event text NOT NULL, -- login | logout | password_changed | password_reset_requested
  ip text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_access_logs TO authenticated;
GRANT ALL ON public.admin_access_logs TO service_role;
ALTER TABLE public.admin_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logs_insert_self"
  ON public.admin_access_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "logs_read_super_admin"
  ON public.admin_access_logs FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "logs_read_own"
  ON public.admin_access_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 2. NOTIFICATIONS (in-app bell)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL, -- appointment_new | appointment_reminder | appointment_cancelled | loyalty_earned | stock_low
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_company_created_idx
  ON public.notifications(company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_member_all"
  ON public.notifications FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- ============================================
-- 3. APPOINTMENT REMINDERS QUEUE
-- ============================================
CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL, -- 24h | 1h
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  channel text NOT NULL DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id, kind)
);
CREATE INDEX IF NOT EXISTS reminders_pending_idx
  ON public.appointment_reminders(scheduled_for) WHERE sent_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_reminders TO authenticated;
GRANT ALL ON public.appointment_reminders TO service_role;
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders_member_all"
  ON public.appointment_reminders FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- Auto-generate reminders whenever an appointment is created or rescheduled
CREATE OR REPLACE FUNCTION public.enqueue_appointment_reminders()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Delete existing pending reminders for this appointment
  DELETE FROM public.appointment_reminders
    WHERE appointment_id = NEW.id AND sent_at IS NULL;

  IF NEW.status IN ('scheduled','confirmed') AND NEW.starts_at > now() THEN
    INSERT INTO public.appointment_reminders (appointment_id, company_id, kind, scheduled_for)
    VALUES
      (NEW.id, NEW.company_id, '24h', NEW.starts_at - interval '24 hours'),
      (NEW.id, NEW.company_id, '1h',  NEW.starts_at - interval '1 hour')
    ON CONFLICT (appointment_id, kind) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enqueue_reminders_ins ON public.appointments;
CREATE TRIGGER trg_enqueue_reminders_ins
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_appointment_reminders();

DROP TRIGGER IF EXISTS trg_enqueue_reminders_upd ON public.appointments;
CREATE TRIGGER trg_enqueue_reminders_upd
  AFTER UPDATE OF starts_at, status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_appointment_reminders();

-- Notify company on new appointment
CREATE OR REPLACE FUNCTION public.notify_new_appointment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  cust_name text;
BEGIN
  SELECT name INTO cust_name FROM public.customers WHERE id = NEW.customer_id;
  INSERT INTO public.notifications (company_id, kind, title, body, link, metadata)
  VALUES (
    NEW.company_id,
    'appointment_new',
    'Novo agendamento',
    COALESCE(cust_name, 'Cliente') || ' para ' || to_char(NEW.starts_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'),
    '/app/agenda',
    jsonb_build_object('appointment_id', NEW.id)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_appt ON public.appointments;
CREATE TRIGGER trg_notify_new_appt
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_appointment();

-- ============================================
-- 4. COUPONS + LOYALTY INTEGRATION IN APPOINTMENTS
-- ============================================
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_points_earned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cashback_earned_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_credited_at timestamptz;

-- Ensure coupons has usage counter (older schema may already have it)
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS used_count integer NOT NULL DEFAULT 0;

-- Public coupon validation function (SECURITY DEFINER, safe columns only)
CREATE OR REPLACE FUNCTION public.validate_coupon(_company uuid, _code text, _subtotal_cents integer)
RETURNS TABLE (
  id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  discount_cents integer,
  message text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record;
  d integer := 0;
BEGIN
  SELECT * INTO c FROM public.coupons
    WHERE company_id = _company
      AND upper(code) = upper(_code)
      AND active = true
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, _code, NULL::text, NULL::numeric, 0, 'Cupom inválido';
    RETURN;
  END IF;

  IF c.valid_from IS NOT NULL AND c.valid_from > now() THEN
    RETURN QUERY SELECT c.id, c.code, c.discount_type, c.discount_value, 0, 'Cupom ainda não válido'; RETURN;
  END IF;
  IF c.valid_until IS NOT NULL AND c.valid_until < now() THEN
    RETURN QUERY SELECT c.id, c.code, c.discount_type, c.discount_value, 0, 'Cupom expirado'; RETURN;
  END IF;
  IF c.usage_limit IS NOT NULL AND c.used_count >= c.usage_limit THEN
    RETURN QUERY SELECT c.id, c.code, c.discount_type, c.discount_value, 0, 'Cupom esgotado'; RETURN;
  END IF;
  IF c.min_purchase_cents IS NOT NULL AND _subtotal_cents < c.min_purchase_cents THEN
    RETURN QUERY SELECT c.id, c.code, c.discount_type, c.discount_value, 0, 'Valor mínimo não atingido'; RETURN;
  END IF;

  IF c.discount_type = 'percent' THEN
    d := (_subtotal_cents * c.discount_value / 100)::integer;
  ELSE
    d := (c.discount_value * 100)::integer;
  END IF;
  IF d > _subtotal_cents THEN d := _subtotal_cents; END IF;

  RETURN QUERY SELECT c.id, c.code, c.discount_type, c.discount_value, d, 'ok';
END; $$;

GRANT EXECUTE ON FUNCTION public.validate_coupon(uuid, text, integer) TO anon, authenticated;

-- On appointment completion, apply coupon usage + credit loyalty/cashback
CREATE OR REPLACE FUNCTION public.finalize_appointment_marketing()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  prog record;
  final_cents integer;
  pts integer := 0;
  cb integer := 0;
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') AND NEW.loyalty_credited_at IS NULL THEN
    final_cents := GREATEST(0, COALESCE(NEW.total_cents,0) - COALESCE(NEW.discount_cents,0));

    -- consume coupon
    IF NEW.coupon_id IS NOT NULL THEN
      UPDATE public.coupons SET used_count = used_count + 1 WHERE id = NEW.coupon_id;
    END IF;

    -- loyalty program
    SELECT * INTO prog FROM public.loyalty_programs
      WHERE company_id = NEW.company_id AND active = true LIMIT 1;

    IF FOUND AND NEW.customer_id IS NOT NULL AND final_cents > 0 THEN
      IF prog.points_per_brl IS NOT NULL AND prog.points_per_brl > 0 THEN
        pts := floor(final_cents / 100.0 * prog.points_per_brl);
      END IF;
      IF prog.cashback_percent IS NOT NULL AND prog.cashback_percent > 0 THEN
        cb := floor(final_cents * prog.cashback_percent / 100.0);
      END IF;

      IF pts > 0 THEN
        INSERT INTO public.loyalty_transactions (company_id, customer_id, type, points, amount_cents, notes)
        VALUES (NEW.company_id, NEW.customer_id, 'earn_points', pts, 0, 'Agendamento #'||substr(NEW.id::text,1,8));
      END IF;
      IF cb > 0 THEN
        INSERT INTO public.loyalty_transactions (company_id, customer_id, type, points, amount_cents, notes)
        VALUES (NEW.company_id, NEW.customer_id, 'earn_cashback', 0, cb, 'Cashback do agendamento #'||substr(NEW.id::text,1,8));
      END IF;

      IF pts > 0 OR cb > 0 THEN
        INSERT INTO public.notifications (company_id, kind, title, body, link, metadata)
        VALUES (NEW.company_id, 'loyalty_earned', 'Fidelidade creditada',
          'Cliente ganhou '||pts||' pts e '||to_char(cb/100.0,'FM999G990D00')||' de cashback',
          '/app/loyalty', jsonb_build_object('customer_id', NEW.customer_id));
      END IF;
    END IF;

    NEW.loyalty_points_earned := pts;
    NEW.cashback_earned_cents := cb;
    NEW.loyalty_credited_at := now();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_finalize_marketing ON public.appointments;
CREATE TRIGGER trg_finalize_marketing
  BEFORE UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.finalize_appointment_marketing();

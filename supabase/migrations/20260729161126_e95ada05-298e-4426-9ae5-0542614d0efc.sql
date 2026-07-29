-- ============ 1. Company deposit / PIX settings ============
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS deposit_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_type text NOT NULL DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS deposit_value numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS pix_key text,
  ADD COLUMN IF NOT EXISTS pix_holder text,
  ADD COLUMN IF NOT EXISTS pix_bank text,
  ADD COLUMN IF NOT EXISTS pix_qr_url text;

DO $$ BEGIN
  ALTER TABLE public.companies ADD CONSTRAINT companies_deposit_type_chk
    CHECK (deposit_type IN ('percent','fixed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.companies ADD CONSTRAINT companies_deposit_value_chk
    CHECK (deposit_value >= 0 AND (deposit_type <> 'percent' OR deposit_value <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ 2. Appointment financial columns ============
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS surcharge_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_required_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';

DO $$ BEGIN
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_payment_status_chk
    CHECK (payment_status IN ('pending','awaiting_approval','deposit_paid','paid','refunded'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ 3. Appointment payments ============
CREATE TABLE IF NOT EXISTS public.appointment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'final',
  amount_cents integer NOT NULL,
  method text,
  status text NOT NULL DEFAULT 'pending',
  proof_url text,
  transaction_ref text,
  notes text,
  reject_reason text,
  created_by uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_payments_kind_chk CHECK (kind IN ('deposit','final','extra','refund')),
  CONSTRAINT appointment_payments_status_chk CHECK (status IN ('pending','approved','rejected')),
  CONSTRAINT appointment_payments_amount_chk CHECK (amount_cents > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_payments TO authenticated;
GRANT ALL ON public.appointment_payments TO service_role;
ALTER TABLE public.appointment_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members manage appointment payments" ON public.appointment_payments;
CREATE POLICY "company members manage appointment payments"
  ON public.appointment_payments FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_appointment_payments_appt ON public.appointment_payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_payments_company ON public.appointment_payments(company_id, status);

DROP TRIGGER IF EXISTS trg_touch_appointment_payments ON public.appointment_payments;
CREATE TRIGGER trg_touch_appointment_payments BEFORE UPDATE ON public.appointment_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ 4. Financial audit log ============
CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  appointment_id uuid,
  payment_id uuid,
  action text NOT NULL,
  description text,
  amount_cents integer NOT NULL DEFAULT 0,
  actor_user_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.financial_audit_log TO authenticated;
GRANT ALL ON public.financial_audit_log TO service_role;
ALTER TABLE public.financial_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members read financial audit" ON public.financial_audit_log;
CREATE POLICY "company members read financial audit"
  ON public.financial_audit_log FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_financial_audit_company ON public.financial_audit_log(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_audit_appt ON public.financial_audit_log(appointment_id);

-- ============ 5. Link cash entries to payments (no duplicates) ============
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS appointment_payment_id uuid REFERENCES public.appointment_payments(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_tx_payment
  ON public.financial_transactions(appointment_payment_id)
  WHERE appointment_payment_id IS NOT NULL;

-- ============ 6. Core recalculation ============
CREATE OR REPLACE FUNCTION public.recalc_appointment_finance(_appt uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a record;
  paid integer := 0;
  due integer := 0;
  st text;
  pending_cnt integer := 0;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = _appt;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(
    CASE WHEN kind = 'refund' THEN -amount_cents ELSE amount_cents END
  ), 0) INTO paid
  FROM public.appointment_payments
  WHERE appointment_id = _appt AND status = 'approved';

  SELECT COUNT(*) INTO pending_cnt
  FROM public.appointment_payments
  WHERE appointment_id = _appt AND status = 'pending';

  due := GREATEST(0, COALESCE(a.total_cents,0) - COALESCE(a.discount_cents,0) + COALESCE(a.surcharge_cents,0));

  IF paid < 0 THEN
    st := 'refunded';
  ELSIF due > 0 AND paid >= due THEN
    st := 'paid';
  ELSIF paid > 0 THEN
    st := 'deposit_paid';
  ELSIF pending_cnt > 0 THEN
    st := 'awaiting_approval';
  ELSE
    st := 'pending';
  END IF;

  UPDATE public.appointments
     SET paid_cents = paid, payment_status = st
   WHERE id = _appt
     AND (paid_cents IS DISTINCT FROM paid OR payment_status IS DISTINCT FROM st);

  PERFORM public.sync_appointment_commissions(_appt);
END; $$;

-- ============ 7. Commissions (only when completed AND fully paid) ============
CREATE OR REPLACE FUNCTION public.sync_appointment_commissions(_appt uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a record;
  rec record;
  cents integer;
  ctype text;
  cvalue numeric;
  total integer := 0;
  cust_name text;
  stf_name text;
  due integer;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = _appt;
  IF NOT FOUND THEN RETURN; END IF;

  due := GREATEST(0, COALESCE(a.total_cents,0) - COALESCE(a.discount_cents,0) + COALESCE(a.surcharge_cents,0));

  -- Cancelled / not completed / not fully paid => remove pending commissions
  IF a.status::text <> 'completed' OR COALESCE(a.paid_cents,0) < due OR due = 0 THEN
    DELETE FROM public.commissions WHERE appointment_id = _appt AND status = 'pending';
    DELETE FROM public.financial_transactions
      WHERE appointment_id = _appt AND category = 'Comissões' AND appointment_payment_id IS NULL;
    RETURN;
  END IF;

  IF a.staff_id IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.commissions WHERE appointment_id = _appt) THEN RETURN; END IF;

  SELECT name INTO stf_name FROM public.staff WHERE id = a.staff_id;
  SELECT name INTO cust_name FROM public.customers WHERE id = a.customer_id;

  FOR rec IN
    SELECT aps.service_id, aps.price_cents, s.name AS service_name,
           s.has_commission, s.commission_type, s.commission_value
    FROM public.appointment_services aps
    JOIN public.services s ON s.id = aps.service_id
    WHERE aps.appointment_id = a.id
  LOOP
    ctype := NULL; cvalue := NULL; cents := 0;
    IF rec.has_commission THEN
      ctype := COALESCE(rec.commission_type, 'percent');
      cvalue := COALESCE(rec.commission_value, 0);
    ELSE
      SELECT 'percent', COALESCE(commission_pct, 0) INTO ctype, cvalue
      FROM public.staff WHERE id = a.staff_id;
    END IF;
    IF cvalue IS NULL OR cvalue <= 0 THEN CONTINUE; END IF;

    IF ctype = 'fixed' THEN
      cents := round(cvalue * 100)::int;
    ELSE
      cents := round(rec.price_cents * cvalue / 100.0)::int;
    END IF;
    IF cents <= 0 THEN CONTINUE; END IF;

    INSERT INTO public.commissions (
      company_id, appointment_id, staff_id, customer_id, service_id,
      staff_name, customer_name, service_name,
      service_amount_cents, commission_type, commission_value, commission_cents,
      status, occurred_at
    ) VALUES (
      a.company_id, a.id, a.staff_id, a.customer_id, rec.service_id,
      stf_name, cust_name, rec.service_name,
      rec.price_cents, ctype, cvalue, cents,
      'pending', COALESCE(a.ends_at, a.starts_at, now())
    ) ON CONFLICT (appointment_id, service_id, staff_id) DO NOTHING;

    total := total + cents;
  END LOOP;

  IF total > 0 THEN
    INSERT INTO public.financial_transactions (
      company_id, type, category, description, amount, occurred_on, appointment_id, staff_id
    ) VALUES (
      a.company_id, 'expense', 'Comissões',
      'Comissão de ' || COALESCE(stf_name, 'funcionário') || ' · agendamento #' || substr(a.id::text, 1, 8),
      (total / 100.0), CURRENT_DATE, a.id, a.staff_id
    );

    INSERT INTO public.financial_audit_log (company_id, appointment_id, action, description, amount_cents)
    VALUES (a.company_id, a.id, 'commission_generated',
            'Comissão calculada para ' || COALESCE(stf_name,'funcionário'), total);

    INSERT INTO public.notifications (company_id, kind, title, body, link, metadata)
    VALUES (a.company_id, 'commission_created', 'Comissão gerada',
      COALESCE(stf_name, 'Funcionário') || ' · ' || to_char(total / 100.0, 'FM999G990D00'),
      '/app/commissions',
      jsonb_build_object('appointment_id', a.id, 'staff_id', a.staff_id, 'total_cents', total));
  END IF;
END; $$;

-- Replace old commission trigger function with the centralized one
CREATE OR REPLACE FUNCTION public.generate_appointment_commissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.recalc_appointment_finance(NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_generate_commissions ON public.appointments;
DROP TRIGGER IF EXISTS trg_generate_appointment_commissions ON public.appointments;
CREATE TRIGGER trg_generate_appointment_commissions
  AFTER UPDATE OF status, total_cents, discount_cents, surcharge_cents ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.generate_appointment_commissions();

-- ============ 8. Payment -> cash + audit ============
CREATE OR REPLACE FUNCTION public.apply_appointment_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  label text;
  appt_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.financial_transactions WHERE appointment_payment_id = OLD.id;
    INSERT INTO public.financial_audit_log (company_id, appointment_id, payment_id, action, description, amount_cents, actor_user_id)
    VALUES (OLD.company_id, OLD.appointment_id, OLD.id, 'payment_deleted', 'Pagamento removido', OLD.amount_cents, auth.uid());
    PERFORM public.recalc_appointment_finance(OLD.appointment_id);
    RETURN OLD;
  END IF;

  label := CASE NEW.kind
    WHEN 'deposit' THEN 'Sinal (pagamento antecipado)'
    WHEN 'final' THEN 'Pagamento do atendimento'
    WHEN 'extra' THEN 'Acréscimo do atendimento'
    ELSE 'Estorno' END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_audit_log (company_id, appointment_id, payment_id, action, description, amount_cents, actor_user_id)
    VALUES (NEW.company_id, NEW.appointment_id, NEW.id,
            CASE WHEN NEW.kind = 'deposit' THEN 'deposit_submitted' ELSE 'payment_created' END,
            label || ' registrado (' || NEW.status || ')', NEW.amount_cents, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.financial_audit_log (company_id, appointment_id, payment_id, action, description, amount_cents, actor_user_id)
    VALUES (NEW.company_id, NEW.appointment_id, NEW.id,
            'payment_' || NEW.status, label || ' ' ||
            CASE NEW.status WHEN 'approved' THEN 'aprovado' WHEN 'rejected' THEN 'rejeitado' ELSE 'pendente' END,
            NEW.amount_cents, auth.uid());
  END IF;

  IF NEW.status = 'approved' THEN
    INSERT INTO public.financial_transactions (
      company_id, type, category, description, amount, occurred_on,
      appointment_id, payment_method_id, appointment_payment_id, created_by
    ) VALUES (
      NEW.company_id,
      CASE WHEN NEW.kind = 'refund' THEN 'expense' ELSE 'income' END::transaction_type,
      CASE WHEN NEW.kind = 'refund' THEN 'Estornos' ELSE 'Serviços' END,
      label || ' · agendamento #' || substr(NEW.appointment_id::text, 1, 8),
      NEW.amount_cents / 100.0, CURRENT_DATE,
      NEW.appointment_id, NULL, NEW.id, COALESCE(NEW.reviewed_by, NEW.created_by)
    ) ON CONFLICT (appointment_payment_id) DO UPDATE
      SET amount = EXCLUDED.amount, description = EXCLUDED.description;
  ELSE
    DELETE FROM public.financial_transactions WHERE appointment_payment_id = NEW.id;
  END IF;

  appt_id := NEW.appointment_id;
  PERFORM public.recalc_appointment_finance(appt_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_apply_appointment_payment ON public.appointment_payments;
CREATE TRIGGER trg_apply_appointment_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.appointment_payments
  FOR EACH ROW EXECUTE FUNCTION public.apply_appointment_payment();

-- ============ 9. Audit for appointment lifecycle ============
CREATE OR REPLACE FUNCTION public.audit_appointment_financial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_audit_log (company_id, appointment_id, action, description, amount_cents, actor_user_id)
    VALUES (NEW.company_id, NEW.id, 'appointment_created', 'Agendamento criado', COALESCE(NEW.total_cents,0), auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.financial_audit_log (company_id, appointment_id, action, description, amount_cents, actor_user_id)
    VALUES (NEW.company_id, NEW.id, 'appointment_status', 'Status: ' || OLD.status::text || ' → ' || NEW.status::text,
            COALESCE(NEW.total_cents,0), auth.uid());
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_audit_appointment_financial ON public.appointments;
CREATE TRIGGER trg_audit_appointment_financial
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.audit_appointment_financial();
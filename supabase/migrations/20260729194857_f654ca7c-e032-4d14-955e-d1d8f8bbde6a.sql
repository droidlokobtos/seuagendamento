-- =====================================================================
-- MÓDULO: CONTROLE DE COMPARECIMENTO
-- =====================================================================

-- 1) Configurações por empresa -----------------------------------------
CREATE TABLE public.attendance_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  lookback_days integer NOT NULL DEFAULT 180,
  late_cancel_hours integer NOT NULL DEFAULT 24,
  weight_completed integer NOT NULL DEFAULT 4,
  weight_no_show integer NOT NULL DEFAULT -25,
  weight_late_cancel integer NOT NULL DEFAULT -12,
  weight_cancel integer NOT NULL DEFAULT -4,
  attention_score integer NOT NULL DEFAULT 70,
  risk_score integer NOT NULL DEFAULT 40,
  min_no_shows_for_action integer NOT NULL DEFAULT 2,
  risk_action text NOT NULL DEFAULT 'require_confirmation',
  reminder_offsets_hours integer[] NOT NULL DEFAULT '{24,3}',
  waitlist_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_risk_action_check
    CHECK (risk_action IN ('none','require_confirmation','require_deposit','block'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_settings TO authenticated;
GRANT ALL ON public.attendance_settings TO service_role;
ALTER TABLE public.attendance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem configuracoes de comparecimento"
  ON public.attendance_settings FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "Admins gerenciam configuracoes de comparecimento"
  ON public.attendance_settings FOR ALL TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

CREATE TRIGGER attendance_settings_touch
  BEFORE UPDATE ON public.attendance_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Cria configuração padrão para empresas existentes e novas
INSERT INTO public.attendance_settings (company_id)
SELECT id FROM public.companies
ON CONFLICT (company_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_attendance_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.attendance_settings (company_id) VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER companies_ensure_attendance_settings
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.ensure_attendance_settings();

-- 2) Histórico de comparecimento ---------------------------------------
CREATE TABLE public.attendance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  event text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz,
  hours_before numeric,
  amount_cents integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_event_kind_check
    CHECK (event IN ('completed','no_show','late_cancel','cancelled_by_customer','cancelled_by_company','cancelled'))
);

CREATE UNIQUE INDEX attendance_events_appt_event_uidx
  ON public.attendance_events (appointment_id, event) WHERE appointment_id IS NOT NULL;
CREATE INDEX attendance_events_company_customer_idx
  ON public.attendance_events (company_id, customer_id, occurred_at DESC);

GRANT SELECT ON public.attendance_events TO authenticated;
GRANT ALL ON public.attendance_events TO service_role;
ALTER TABLE public.attendance_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem historico de comparecimento"
  ON public.attendance_events FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

-- 3) Lista de espera ----------------------------------------------------
CREATE TABLE public.waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  phone text,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  preferred_date date,
  preferred_period text NOT NULL DEFAULT 'any',
  notes text,
  status text NOT NULL DEFAULT 'waiting',
  notified_at timestamptz,
  converted_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_status_check CHECK (status IN ('waiting','notified','converted','cancelled')),
  CONSTRAINT waitlist_period_check CHECK (preferred_period IN ('any','morning','afternoon','evening'))
);

CREATE INDEX waitlist_company_status_idx ON public.waitlist_entries (company_id, status, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist_entries TO authenticated;
GRANT ALL ON public.waitlist_entries TO service_role;
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros gerenciam lista de espera"
  ON public.waitlist_entries FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER waitlist_touch
  BEFORE UPDATE ON public.waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Registro automático de eventos + lista de espera --------------------
CREATE OR REPLACE FUNCTION public.log_attendance_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev text;
  late_h integer;
  hb numeric;
  amount integer;
  waiting_cnt integer := 0;
BEGIN
  IF NEW.customer_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(late_cancel_hours, 24) INTO late_h
    FROM public.attendance_settings WHERE company_id = NEW.company_id;
  late_h := COALESCE(late_h, 24);

  hb := EXTRACT(EPOCH FROM (NEW.starts_at - now())) / 3600.0;
  amount := GREATEST(0, COALESCE(NEW.total_cents,0) - COALESCE(NEW.discount_cents,0));

  ev := CASE NEW.status::text
    WHEN 'completed' THEN 'completed'
    WHEN 'no_show' THEN 'no_show'
    WHEN 'cancelled_by_company' THEN 'cancelled_by_company'
    WHEN 'cancelled_by_customer' THEN
      CASE WHEN hb < late_h THEN 'late_cancel' ELSE 'cancelled_by_customer' END
    WHEN 'cancelled' THEN
      CASE WHEN hb < late_h THEN 'late_cancel' ELSE 'cancelled' END
    ELSE NULL END;

  IF ev IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.attendance_events
    (company_id, customer_id, appointment_id, event, occurred_at, scheduled_for, hours_before, amount_cents)
  VALUES
    (NEW.company_id, NEW.customer_id, NEW.id, ev, now(), NEW.starts_at, round(hb::numeric, 2), amount)
  ON CONFLICT (appointment_id, event) DO NOTHING;

  -- Horário liberado -> avisa sobre a lista de espera
  IF ev IN ('no_show','late_cancel','cancelled','cancelled_by_customer','cancelled_by_company')
     AND NEW.starts_at > now() THEN
    IF COALESCE((SELECT waitlist_enabled FROM public.attendance_settings WHERE company_id = NEW.company_id), true) THEN
      SELECT COUNT(*) INTO waiting_cnt FROM public.waitlist_entries
        WHERE company_id = NEW.company_id AND status = 'waiting';
      IF waiting_cnt > 0 THEN
        INSERT INTO public.notifications (company_id, kind, title, body, link, metadata)
        VALUES (
          NEW.company_id, 'waitlist_slot', 'Horário liberado',
          waiting_cnt || ' cliente(s) na lista de espera para ' ||
            to_char(NEW.starts_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI'),
          '/app/attendance',
          jsonb_build_object('appointment_id', NEW.id, 'starts_at', NEW.starts_at, 'waiting', waiting_cnt)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER appointments_log_attendance
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.log_attendance_event();

-- 5) Confiabilidade do cliente ------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_reliability(_company uuid)
RETURNS TABLE (
  customer_id uuid,
  completed integer,
  no_shows integer,
  late_cancels integer,
  cancels integer,
  total integer,
  attendance_rate numeric,
  score integer,
  classification text,
  last_event_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record;
BEGIN
  IF NOT public.is_company_member(_company) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT * INTO s FROM public.attendance_settings WHERE company_id = _company;

  RETURN QUERY
  WITH cfg AS (
    SELECT COALESCE(s.lookback_days,180) AS lookback,
           COALESCE(s.weight_completed,4) AS w_ok,
           COALESCE(s.weight_no_show,-25) AS w_ns,
           COALESCE(s.weight_late_cancel,-12) AS w_lc,
           COALESCE(s.weight_cancel,-4) AS w_c,
           COALESCE(s.attention_score,70) AS t_att,
           COALESCE(s.risk_score,40) AS t_risk
  ), agg AS (
    SELECT e.customer_id AS cid,
      COUNT(*) FILTER (WHERE e.event = 'completed')::int AS ok,
      COUNT(*) FILTER (WHERE e.event = 'no_show')::int AS ns,
      COUNT(*) FILTER (WHERE e.event = 'late_cancel')::int AS lc,
      COUNT(*) FILTER (WHERE e.event IN ('cancelled','cancelled_by_customer'))::int AS c,
      COUNT(*)::int AS tot,
      MAX(e.occurred_at) AS last_at
    FROM public.attendance_events e, cfg
    WHERE e.company_id = _company
      AND e.occurred_at >= now() - (cfg.lookback || ' days')::interval
      AND e.event <> 'cancelled_by_company'
    GROUP BY e.customer_id
  )
  SELECT a.cid,
    a.ok, a.ns, a.lc, a.c, a.tot,
    CASE WHEN (a.ok + a.ns) > 0 THEN round(a.ok::numeric * 100 / (a.ok + a.ns), 1) ELSE 100::numeric END,
    GREATEST(0, LEAST(100,
      70 + a.ok * cfg.w_ok + a.ns * cfg.w_ns + a.lc * cfg.w_lc + a.c * cfg.w_c))::int,
    CASE
      WHEN GREATEST(0, LEAST(100, 70 + a.ok * cfg.w_ok + a.ns * cfg.w_ns + a.lc * cfg.w_lc + a.c * cfg.w_c)) < cfg.t_risk THEN 'high_risk'
      WHEN GREATEST(0, LEAST(100, 70 + a.ok * cfg.w_ok + a.ns * cfg.w_ns + a.lc * cfg.w_lc + a.c * cfg.w_c)) < cfg.t_att THEN 'attention'
      ELSE 'reliable'
    END,
    a.last_at
  FROM agg a, cfg;
END; $$;

REVOKE EXECUTE ON FUNCTION public.customer_reliability(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_reliability(uuid) TO authenticated, service_role;

-- Regra pública aplicável a um cliente (usada no agendamento online)
CREATE OR REPLACE FUNCTION public.customer_booking_rule(_company uuid, _customer uuid)
RETURNS TABLE (action text, no_shows integer, score integer, classification text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; r record;
BEGIN
  SELECT * INTO s FROM public.attendance_settings WHERE company_id = _company;
  IF _customer IS NULL THEN
    RETURN QUERY SELECT 'none'::text, 0, 100, 'reliable'::text; RETURN;
  END IF;

  WITH cfg AS (
    SELECT COALESCE(s.lookback_days,180) AS lookback,
           COALESCE(s.weight_completed,4) AS w_ok,
           COALESCE(s.weight_no_show,-25) AS w_ns,
           COALESCE(s.weight_late_cancel,-12) AS w_lc,
           COALESCE(s.weight_cancel,-4) AS w_c,
           COALESCE(s.attention_score,70) AS t_att,
           COALESCE(s.risk_score,40) AS t_risk
  ), agg AS (
    SELECT
      COUNT(*) FILTER (WHERE e.event = 'completed')::int AS ok,
      COUNT(*) FILTER (WHERE e.event = 'no_show')::int AS ns,
      COUNT(*) FILTER (WHERE e.event = 'late_cancel')::int AS lc,
      COUNT(*) FILTER (WHERE e.event IN ('cancelled','cancelled_by_customer'))::int AS c
    FROM public.attendance_events e, cfg
    WHERE e.company_id = _company AND e.customer_id = _customer
      AND e.occurred_at >= now() - (cfg.lookback || ' days')::interval
      AND e.event <> 'cancelled_by_company'
  )
  SELECT
    GREATEST(0, LEAST(100, 70 + a.ok*cfg.w_ok + a.ns*cfg.w_ns + a.lc*cfg.w_lc + a.c*cfg.w_c))::int AS sc,
    a.ns AS ns,
    cfg.t_att AS t_att, cfg.t_risk AS t_risk
  INTO r FROM agg a, cfg;

  RETURN QUERY SELECT
    CASE
      WHEN COALESCE(s.risk_action,'none') = 'none' THEN 'none'
      WHEN r.ns >= COALESCE(s.min_no_shows_for_action, 2) OR r.sc < r.t_risk THEN s.risk_action
      ELSE 'none'
    END,
    r.ns,
    r.sc,
    CASE WHEN r.sc < r.t_risk THEN 'high_risk'
         WHEN r.sc < r.t_att THEN 'attention'
         ELSE 'reliable' END;
END; $$;

REVOKE EXECUTE ON FUNCTION public.customer_booking_rule(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_booking_rule(uuid, uuid) TO anon, authenticated, service_role;

-- 6) Lembretes seguem as configurações da empresa ------------------------
CREATE OR REPLACE FUNCTION public.enqueue_appointment_reminders()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  offsets integer[];
  h integer;
BEGIN
  DELETE FROM public.appointment_reminders
    WHERE appointment_id = NEW.id AND sent_at IS NULL AND kind <> 'review';

  IF NEW.status IN ('scheduled','confirmed') AND NEW.starts_at > now() THEN
    SELECT reminder_offsets_hours INTO offsets
      FROM public.attendance_settings WHERE company_id = NEW.company_id;
    IF offsets IS NULL OR array_length(offsets, 1) IS NULL THEN
      offsets := ARRAY[24, 1];
    END IF;

    FOREACH h IN ARRAY offsets LOOP
      IF NEW.starts_at - (h || ' hours')::interval > now() THEN
        INSERT INTO public.appointment_reminders (appointment_id, company_id, kind, scheduled_for)
        VALUES (NEW.id, NEW.company_id, h || 'h', NEW.starts_at - (h || ' hours')::interval)
        ON CONFLICT (appointment_id, kind) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
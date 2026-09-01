CREATE TABLE IF NOT EXISTS public.ai_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical','attention','opportunity','positive')),
  title text NOT NULL,
  description text NOT NULL,
  metric text,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  reopened_count integer NOT NULL DEFAULT 0,
  occurrence_count integer NOT NULL DEFAULT 1,
  last_event_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, alert_key)
);

CREATE INDEX IF NOT EXISTS ai_alerts_company_status_idx
  ON public.ai_alerts(company_id, status, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  alert_id uuid NOT NULL REFERENCES public.ai_alerts(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('opened','updated','resolved','reopened')),
  severity text NOT NULL CHECK (severity IN ('critical','attention','opportunity','positive')),
  title text NOT NULL,
  description text NOT NULL,
  metric text,
  action text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_alert_events_company_created_idx
  ON public.ai_alert_events(company_id, created_at DESC);

ALTER TABLE public.ai_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_alert_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai alerts member read" ON public.ai_alerts;
CREATE POLICY "ai alerts member read" ON public.ai_alerts
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "ai alerts member insert" ON public.ai_alerts;
CREATE POLICY "ai alerts member insert" ON public.ai_alerts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "ai alerts member update" ON public.ai_alerts;
CREATE POLICY "ai alerts member update" ON public.ai_alerts
  FOR UPDATE TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "ai alert events member read" ON public.ai_alert_events;
CREATE POLICY "ai alert events member read" ON public.ai_alert_events
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "ai alert events member insert" ON public.ai_alert_events;
CREATE POLICY "ai alert events member insert" ON public.ai_alert_events
  FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(company_id));

-- Automação confiável: configuração central, segredo interno, execução sem
-- sobreposição, histórico e substituição do cron antigo com URL/chave fixas.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.automation_runtime_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  base_url text NOT NULL,
  hook_secret text NOT NULL CHECK (length(hook_secret) >= 32),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  request_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','success','failed')),
  processed_count integer NOT NULL DEFAULT 0 CHECK (processed_count >= 0),
  skipped_count integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer
);

CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_one_running_job_idx
  ON public.automation_runs(job_name) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS automation_runs_job_started_idx
  ON public.automation_runs(job_name, started_at DESC);

ALTER TABLE public.automation_runtime_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.automation_runtime_config FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.automation_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.automation_runtime_config TO service_role;
GRANT ALL ON public.automation_runs TO service_role;

INSERT INTO public.automation_runtime_config(id, base_url, hook_secret, enabled)
VALUES (
  true,
  'https://seuagendamento.lovable.app',
  encode(gen_random_bytes(32), 'hex'),
  true
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.try_start_automation_run(
  _job_name text,
  _request_id text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF length(trim(_job_name)) < 1 OR length(_job_name) > 80 THEN
    RAISE EXCEPTION 'Invalid job name';
  END IF;

  -- Uma execução interrompida não pode bloquear o job para sempre.
  UPDATE public.automation_runs
     SET status = 'failed',
         finished_at = now(),
         duration_ms = greatest(0, (extract(epoch FROM (now() - started_at)) * 1000)::integer),
         error_message = 'Execução anterior interrompida ou excedeu 15 minutos'
   WHERE job_name = _job_name
     AND status = 'running'
     AND started_at < now() - interval '15 minutes';

  BEGIN
    INSERT INTO public.automation_runs(job_name, request_id, status)
    VALUES (_job_name, left(_request_id, 100), 'running')
    RETURNING id INTO new_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN NULL;
  END;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_automation_run(
  _run_id uuid,
  _status text,
  _processed_count integer,
  _skipped_count integer,
  _failed_count integer,
  _error_message text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _status NOT IN ('success','failed') THEN
    RAISE EXCEPTION 'Invalid final status';
  END IF;

  UPDATE public.automation_runs
     SET status = _status,
         processed_count = greatest(0, COALESCE(_processed_count, 0)),
         skipped_count = greatest(0, COALESCE(_skipped_count, 0)),
         failed_count = greatest(0, COALESCE(_failed_count, 0)),
         error_message = left(_error_message, 500),
         finished_at = now(),
         duration_ms = greatest(0, (extract(epoch FROM (now() - started_at)) * 1000)::integer)
   WHERE id = _run_id AND status = 'running';
END;
$$;

REVOKE ALL ON FUNCTION public.try_start_automation_run(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_automation_run(uuid, text, integer, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_start_automation_run(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_automation_run(uuid, text, integer, integer, integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.get_automation_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT jsonb_build_object(
    'base_url', c.base_url,
    'enabled', c.enabled,
    'scheduled_jobs', (
      SELECT count(*) FROM cron.job
      WHERE jobname IN ('beautysaas-confirmations','beautysaas-review-invites')
        AND active = true
    ),
    'last_success_at', (
      SELECT max(finished_at) FROM public.automation_runs WHERE status = 'success'
    ),
    'last_failure_at', (
      SELECT max(finished_at) FROM public.automation_runs WHERE status = 'failed'
    ),
    'failures_last_24h', (
      SELECT count(*) FROM public.automation_runs
      WHERE status = 'failed' AND started_at >= now() - interval '24 hours'
    ),
    'running_jobs', (
      SELECT count(*) FROM public.automation_runs WHERE status = 'running'
    )
  ) INTO result
  FROM public.automation_runtime_config c
  WHERE c.id = true;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_automation_runtime_config(
  _base_url text,
  _enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF _base_url !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$' THEN
    RAISE EXCEPTION 'Informe uma URL HTTPS válida, sem caminho final';
  END IF;

  UPDATE public.automation_runtime_config
     SET base_url = rtrim(_base_url, '/'),
         enabled = COALESCE(_enabled, true),
         updated_at = now()
   WHERE id = true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_automation_health() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_automation_runtime_config(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_automation_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_automation_runtime_config(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_confirmation_sent(_confirmation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data public.appointment_confirmations%ROWTYPE;
BEGIN
  SELECT * INTO row_data
  FROM public.appointment_confirmations
  WHERE id = _confirmation_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.is_company_member(row_data.company_id) THEN
    RAISE EXCEPTION 'Confirmação não encontrada ou acesso negado';
  END IF;
  IF row_data.status IN ('confirmed','cancelled','expired') THEN
    RAISE EXCEPTION 'Esta confirmação não pode mais ser marcada como enviada';
  END IF;

  UPDATE public.appointment_confirmations
     SET status = 'sent',
         sent_at = COALESCE(sent_at, now()),
         last_sent_at = now(),
         send_attempts = send_attempts + 1,
         error = NULL
   WHERE id = _confirmation_id;

  INSERT INTO public.messaging_logs(
    company_id, appointment_id, confirmation_id, channel,
    event, status, detail, actor_user_id
  ) VALUES (
    row_data.company_id, row_data.appointment_id, row_data.id, row_data.channel,
    'marked_sent', 'sent', 'Envio manual confirmado pelo usuário', auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_review_invite_sent(_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data public.review_invites%ROWTYPE;
BEGIN
  SELECT * INTO row_data
  FROM public.review_invites
  WHERE id = _invite_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.is_company_member(row_data.company_id) THEN
    RAISE EXCEPTION 'Convite não encontrado ou acesso negado';
  END IF;
  IF row_data.status IN ('answered','expired') THEN
    RAISE EXCEPTION 'Este convite não pode mais ser marcado como enviado';
  END IF;

  UPDATE public.review_invites
     SET status = 'sent',
         sent_at = COALESCE(sent_at, now()),
         last_sent_at = now(),
         send_attempts = send_attempts + 1,
         error = NULL
   WHERE id = _invite_id;

  INSERT INTO public.review_logs(
    company_id, invite_id, appointment_id, customer_id,
    event, channel, detail
  ) VALUES (
    row_data.company_id, row_data.id, row_data.appointment_id, row_data.customer_id,
    'marked_sent', row_data.channel, 'Envio manual confirmado pelo usuário'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_confirmation_sent(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_review_invite_sent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_confirmation_sent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_review_invite_sent(uuid) TO authenticated;

-- O status ready significa que o texto/link foi preparado, mas ainda não foi
-- efetivamente enviado no WhatsApp.
ALTER TABLE public.review_invites DROP CONSTRAINT IF EXISTS review_invites_status_chk;
ALTER TABLE public.review_invites
  ADD CONSTRAINT review_invites_status_chk
  CHECK (status IN ('pending','ready','sent','failed','answered','expired'));

-- Remove a chamada legada que continha endereço e chave públicos fixos.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN (
  'review-invites-dispatch',
  'appointment-confirmations-dispatch',
  'beautysaas-confirmations',
  'beautysaas-review-invites'
);

SELECT cron.schedule(
  'beautysaas-confirmations',
  '*/10 * * * *',
  $job$
  SELECT net.http_post(
    url := rtrim(c.base_url, '/') || '/api/public/hooks/confirmations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', c.hook_secret,
      'x-request-id', gen_random_uuid()::text
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  FROM public.automation_runtime_config c
  WHERE c.id = true AND c.enabled = true;
  $job$
);

SELECT cron.schedule(
  'beautysaas-review-invites',
  '*/15 * * * *',
  $job$
  SELECT net.http_post(
    url := rtrim(c.base_url, '/') || '/api/public/hooks/review-invites',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-automation-secret', c.hook_secret,
      'x-request-id', gen_random_uuid()::text
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  FROM public.automation_runtime_config c
  WHERE c.id = true AND c.enabled = true;
  $job$
);

CREATE OR REPLACE FUNCTION public.system_health_snapshot()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'database', true,
    'rate_limit_table', to_regclass('public.public_api_rate_limits') IS NOT NULL,
    'observability_table', to_regclass('public.public_api_events') IS NOT NULL,
    'verification_table', to_regclass('public.public_client_verifications') IS NOT NULL,
    'automation_config', to_regclass('public.automation_runtime_config') IS NOT NULL,
    'automation_runs', to_regclass('public.automation_runs') IS NOT NULL,
    'automation_enabled', EXISTS (
      SELECT 1 FROM public.automation_runtime_config WHERE id = true AND enabled = true
    ),
    'automation_jobs', (
      SELECT count(*) = 2 FROM cron.job
      WHERE jobname IN ('beautysaas-confirmations','beautysaas-review-invites')
    ),
    'overlap_trigger', EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'appointments_prevent_overlap'
    ),
    'checked_at', now()
  );
$$;

REVOKE ALL ON FUNCTION public.system_health_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.system_health_snapshot() TO service_role;

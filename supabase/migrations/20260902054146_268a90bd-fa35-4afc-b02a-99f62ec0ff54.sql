CREATE TABLE IF NOT EXISTS public.public_api_rate_limits (
  scope text NOT NULL,
  identifier_hash text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, identifier_hash, window_started_at)
);

CREATE TABLE IF NOT EXISTS public.public_client_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  phone_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.public_api_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope text NOT NULL,
  identifier_hash text,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  outcome text NOT NULL CHECK (outcome IN ('allowed', 'blocked', 'error', 'success')),
  status_code integer,
  duration_ms integer,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.public_api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_client_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_api_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.public_api_rate_limits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.public_client_verifications FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.public_api_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.public_api_rate_limits TO service_role;
GRANT ALL ON public.public_client_verifications TO service_role;
GRANT ALL ON public.public_api_events TO service_role;

CREATE OR REPLACE FUNCTION public.consume_public_rate_limit(
  _scope text,
  _identifier_hash text,
  _limit integer,
  _window_seconds integer
)
RETURNS TABLE(allowed boolean, remaining integer, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bucket timestamptz;
  current_count integer;
BEGIN
  IF _limit < 1 OR _window_seconds < 1 OR length(_scope) > 80 OR length(_identifier_hash) > 128 THEN
    RAISE EXCEPTION 'Invalid rate limit configuration';
  END IF;

  bucket := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);

  IF random() < 0.01 THEN
    DELETE FROM public.public_api_rate_limits WHERE window_started_at < now() - interval '2 days';
    DELETE FROM public.public_client_verifications WHERE expires_at < now() - interval '2 days';
    DELETE FROM public.public_api_events WHERE created_at < now() - interval '90 days';
  END IF;

  INSERT INTO public.public_api_rate_limits(scope, identifier_hash, window_started_at, request_count)
  VALUES (_scope, _identifier_hash, bucket, 1)
  ON CONFLICT (scope, identifier_hash, window_started_at)
  DO UPDATE SET request_count = public.public_api_rate_limits.request_count + 1, updated_at = now()
  RETURNING request_count INTO current_count;

  RETURN QUERY SELECT
    current_count <= _limit,
    greatest(0, _limit - current_count),
    greatest(1, ceil(extract(epoch FROM bucket + make_interval(secs => _window_seconds) - now()))::integer);
END;
$$;

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
    'overlap_trigger', EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'appointments_prevent_overlap'
    ),
    'checked_at', now()
  );
$$;

REVOKE ALL ON FUNCTION public.consume_public_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.system_health_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_rate_limit(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.system_health_snapshot() TO service_role;

CREATE INDEX IF NOT EXISTS public_api_events_created_idx ON public.public_api_events(created_at DESC);
CREATE INDEX IF NOT EXISTS public_api_events_scope_idx ON public.public_api_events(scope, created_at DESC);
CREATE INDEX IF NOT EXISTS public_client_verifications_expiry_idx ON public.public_client_verifications(expires_at);
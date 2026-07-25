CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Configurações de avaliação por empresa
CREATE TABLE public.review_settings (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  google_review_url text,
  expiration_days integer NOT NULL DEFAULT 30,
  auto_send_enabled boolean NOT NULL DEFAULT true,
  active_channels text[] NOT NULL DEFAULT ARRAY['whatsapp'],
  message_template text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_settings TO authenticated;
GRANT ALL ON public.review_settings TO service_role;
ALTER TABLE public.review_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_settings company access" ON public.review_settings
  FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER trg_review_settings_updated BEFORE UPDATE ON public.review_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Convites (links únicos) de avaliação
CREATE TABLE public.review_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  channel text,
  message text,
  send_url text,
  sent_at timestamptz,
  last_sent_at timestamptz,
  send_attempts integer NOT NULL DEFAULT 0,
  review_id uuid REFERENCES public.reviews(id) ON DELETE SET NULL,
  rating integer,
  responded_at timestamptz,
  response_ip text,
  response_user_agent text,
  error text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);
CREATE INDEX idx_review_invites_company ON public.review_invites(company_id, created_at DESC);
CREATE INDEX idx_review_invites_status ON public.review_invites(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_invites TO authenticated;
GRANT ALL ON public.review_invites TO service_role;
ALTER TABLE public.review_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_invites company access" ON public.review_invites
  FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER trg_review_invites_updated BEFORE UPDATE ON public.review_invites
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Logs de avaliação
CREATE TABLE public.review_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invite_id uuid REFERENCES public.review_invites(id) ON DELETE SET NULL,
  review_id uuid REFERENCES public.reviews(id) ON DELETE SET NULL,
  appointment_id uuid,
  customer_id uuid,
  event text NOT NULL,
  channel text,
  rating integer,
  comment text,
  detail text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_review_logs_company ON public.review_logs(company_id, created_at DESC);
GRANT SELECT ON public.review_logs TO authenticated;
GRANT ALL ON public.review_logs TO service_role;
ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_logs company read" ON public.review_logs
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));

-- 4. Campos extras nas avaliações
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES public.review_invites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS staff_rating integer,
  ADD COLUMN IF NOT EXISTS would_return boolean,
  ADD COLUMN IF NOT EXISTS would_recommend boolean,
  ADD COLUMN IF NOT EXISTS service_names text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'link',
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS user_agent text;

-- 5. Validade padrão definida pelo Admin Master
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS review_expiration_days integer NOT NULL DEFAULT 30;

-- 6. Geração automática do convite ao concluir o atendimento
CREATE OR REPLACE FUNCTION public.generate_review_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days integer;
  tok text;
BEGIN
  IF NEW.status::text <> 'completed' OR OLD.status::text = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(rs.expiration_days, ps.review_expiration_days, 30)
    INTO days
  FROM (SELECT 1) x
  LEFT JOIN public.review_settings rs ON rs.company_id = NEW.company_id
  LEFT JOIN public.platform_settings ps ON ps.id = true;

  days := COALESCE(days, 30);
  tok := upper(encode(gen_random_bytes(6), 'hex'));

  INSERT INTO public.review_invites (
    company_id, appointment_id, customer_id, staff_id, token, status, expires_at
  ) VALUES (
    NEW.company_id, NEW.id, NEW.customer_id, NEW.staff_id, tok, 'pending',
    now() + (days || ' days')::interval
  )
  ON CONFLICT (appointment_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_review_invite ON public.appointments;
CREATE TRIGGER trg_generate_review_invite
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.generate_review_invite();
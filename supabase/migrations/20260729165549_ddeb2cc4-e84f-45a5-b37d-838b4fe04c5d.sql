CREATE TABLE public.whatsapp_integrations (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'disconnected',
  device_name text,
  phone_number text,
  session_ref text,
  api_url text,
  api_token text,
  auto_send_enabled boolean NOT NULL DEFAULT true,
  reminder_offsets_hours integer[] NOT NULL DEFAULT '{24,1}',
  max_attempts integer NOT NULL DEFAULT 3,
  last_sync_at timestamptz,
  last_activity_at timestamptz,
  connected_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_integrations TO authenticated;
GRANT ALL ON public.whatsapp_integrations TO service_role;
ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_integrations_admin" ON public.whatsapp_integrations FOR ALL TO authenticated
  USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE TRIGGER wa_integrations_touch BEFORE UPDATE ON public.whatsapp_integrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event text NOT NULL,
  body text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, event)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_templates_read" ON public.whatsapp_templates FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "wa_templates_write" ON public.whatsapp_templates FOR ALL TO authenticated
  USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));
CREATE TRIGGER wa_templates_touch BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  appointment_id uuid,
  customer_id uuid,
  event text NOT NULL,
  provider text NOT NULL DEFAULT 'manual',
  to_phone text,
  content text NOT NULL,
  wa_url text,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  error text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whatsapp_messages_company_created_idx ON public.whatsapp_messages (company_id, created_at DESC);
CREATE INDEX whatsapp_messages_pending_idx ON public.whatsapp_messages (status, scheduled_for);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_messages_read" ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "wa_messages_write" ON public.whatsapp_messages FOR ALL TO authenticated
  USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER wa_messages_touch BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
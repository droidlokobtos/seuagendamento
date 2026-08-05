ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS owner_whatsapp text,
  ADD COLUMN IF NOT EXISTS contracted_plan text,
  ADD COLUMN IF NOT EXISTS admin_notes text;

CREATE OR REPLACE FUNCTION public.validate_company_registration()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  phone_digits text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    phone_digits := regexp_replace(coalesce(NEW.owner_whatsapp, ''), '\D', '', 'g');
    IF length(trim(coalesce(NEW.owner_name, ''))) < 2 THEN
      RAISE EXCEPTION 'Nome do proprietário é obrigatório';
    END IF;
    IF NEW.email IS NULL OR NEW.email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
      RAISE EXCEPTION 'E-mail do proprietário inválido';
    END IF;
    IF phone_digits !~ '^[1-9]{2}9[0-9]{8}$' THEN
      RAISE EXCEPTION 'WhatsApp deve ser um celular brasileiro com DDD';
    END IF;
    IF length(trim(coalesce(NEW.contracted_plan, ''))) < 1 THEN
      RAISE EXCEPTION 'Plano contratado é obrigatório';
    END IF;
    IF NEW.next_due_at IS NULL THEN
      RAISE EXCEPTION 'Data de vencimento é obrigatória';
    END IF;
    NEW.owner_whatsapp := phone_digits;
    NEW.responsible_name := NEW.owner_name;
    NEW.whatsapp := NEW.owner_whatsapp;
  ELSIF NEW.owner_whatsapp IS DISTINCT FROM OLD.owner_whatsapp AND NEW.owner_whatsapp IS NOT NULL THEN
    phone_digits := regexp_replace(NEW.owner_whatsapp, '\D', '', 'g');
    IF phone_digits !~ '^[1-9]{2}9[0-9]{8}$' THEN
      RAISE EXCEPTION 'WhatsApp deve ser um celular brasileiro com DDD';
    END IF;
    NEW.owner_whatsapp := phone_digits;
    NEW.whatsapp := phone_digits;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_company_registration_trigger ON public.companies;
CREATE TRIGGER validate_company_registration_trigger
BEFORE INSERT OR UPDATE OF owner_whatsapp ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.validate_company_registration();

CREATE OR REPLACE FUNCTION public.has_any_permission(_company uuid, _keys text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = _company
      AND cu.user_id = auth.uid()
      AND cu.active
      AND (
        cu.role = 'company_admin'
        OR EXISTS (
          SELECT 1 FROM unnest(_keys) AS k
          WHERE COALESCE((cu.permissions ->> k)::boolean, false)
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.has_any_permission(uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_any_permission(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_permission(uuid, text[]) TO service_role;

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'appointments','appointment_services','appointment_confirmations','appointment_payments','appointment_products','appointment_reminders',
        'attendance_events','attendance_settings','time_blocks','waitlist_entries',
        'customers','customer_dates','customer_notes','customer_profiles','customer_profile_history','anamnesis_records','anamnesis_access_log',
        'services','staff','staff_schedules','staff_services','gallery_photos','plans','plan_services','customer_plans','customer_plan_services','plan_session_usage','plan_audit_log','procedures','procedure_items','procedure_costs','procedure_staff_prices','procedure_versions','procedure_audit_log',
        'financial_transactions','financial_audit_log','payments','payment_methods','payment_options','commissions','sales','sale_items','sale_payments','commerce_audit_log',
        'products','inventory_movements','unit_conversions','overhead_costs','costing_settings',
        'campaigns','coupons','loyalty_programs','loyalty_rewards','loyalty_transactions','reviews','review_invites','review_logs','review_settings','messaging_logs','messaging_settings','notifications','whatsapp_integrations','whatsapp_messages','whatsapp_templates',
        'company_hours','company_users','user_audit_log'
      )
      AND (coalesce(qual, '') LIKE '%is_company_member%' OR coalesce(with_check, '') LIKE '%is_company_member%')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

DO $$
DECLARE r record;
DECLARE keys text[];
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('appointments', ARRAY['agenda','agendamentos']), ('appointment_confirmations', ARRAY['agendamentos']), ('appointment_payments', ARRAY['agendamentos','financeiro','caixa']), ('appointment_products', ARRAY['agendamentos','estoque']), ('appointment_reminders', ARRAY['agendamentos']), ('attendance_events', ARRAY['agendamentos']), ('attendance_settings', ARRAY['agendamentos']), ('time_blocks', ARRAY['agenda']), ('waitlist_entries', ARRAY['agenda','agendamentos']),
    ('customers', ARRAY['clientes']), ('customer_dates', ARRAY['clientes']), ('customer_notes', ARRAY['clientes']), ('customer_profiles', ARRAY['clientes']), ('customer_profile_history', ARRAY['clientes']), ('anamnesis_records', ARRAY['clientes']), ('anamnesis_access_log', ARRAY['clientes']),
    ('services', ARRAY['servicos']), ('staff', ARRAY['configuracoes']), ('staff_schedules', ARRAY['configuracoes','agenda']), ('gallery_photos', ARRAY['servicos']), ('plans', ARRAY['servicos']), ('customer_plans', ARRAY['servicos','clientes']), ('plan_session_usage', ARRAY['servicos','clientes']), ('plan_audit_log', ARRAY['servicos']), ('procedures', ARRAY['servicos']), ('procedure_items', ARRAY['servicos']), ('procedure_costs', ARRAY['servicos']), ('procedure_staff_prices', ARRAY['servicos']), ('procedure_versions', ARRAY['servicos']), ('procedure_audit_log', ARRAY['servicos']),
    ('financial_transactions', ARRAY['financeiro']), ('financial_audit_log', ARRAY['financeiro']), ('payments', ARRAY['financeiro']), ('payment_methods', ARRAY['financeiro']), ('payment_options', ARRAY['financeiro','caixa']), ('commissions', ARRAY['comissoes']), ('sales', ARRAY['caixa']), ('sale_items', ARRAY['caixa']), ('sale_payments', ARRAY['caixa']), ('commerce_audit_log', ARRAY['caixa','financeiro']),
    ('products', ARRAY['estoque']), ('inventory_movements', ARRAY['estoque']), ('unit_conversions', ARRAY['estoque','servicos']), ('overhead_costs', ARRAY['financeiro','servicos']), ('costing_settings', ARRAY['financeiro','servicos']),
    ('campaigns', ARRAY['clientes']), ('coupons', ARRAY['financeiro']), ('loyalty_programs', ARRAY['clientes']), ('loyalty_rewards', ARRAY['clientes']), ('loyalty_transactions', ARRAY['clientes']), ('reviews', ARRAY['clientes']), ('review_invites', ARRAY['clientes']), ('review_logs', ARRAY['clientes']), ('review_settings', ARRAY['configuracoes']), ('messaging_logs', ARRAY['configuracoes']), ('messaging_settings', ARRAY['configuracoes']), ('notifications', ARRAY['dashboard']), ('whatsapp_integrations', ARRAY['configuracoes']), ('whatsapp_messages', ARRAY['configuracoes']), ('whatsapp_templates', ARRAY['configuracoes']),
    ('company_hours', ARRAY['configuracoes']), ('user_audit_log', ARRAY['usuarios'])
  ) AS x(table_name, permission_keys)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=r.table_name AND column_name='company_id') THEN
      keys := r.permission_keys;
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_any_permission(company_id, %L::text[])) WITH CHECK (public.has_any_permission(company_id, %L::text[]))', 'permission scoped access', r.table_name, keys, keys);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
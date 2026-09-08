-- Revisão pré-merge: consumo idempotente, classificação financeira e vínculos atômicos.

-- Permite estornar um uso ligado a agendamento e consumir novamente quando o
-- atendimento for concluído depois. Apenas usos ativos participam da unicidade.
DROP INDEX IF EXISTS public.plan_session_usage_uidx;
DROP INDEX IF EXISTS public.psu_unique_appt_service;
CREATE UNIQUE INDEX IF NOT EXISTS plan_session_usage_active_appt_service_uidx
  ON public.plan_session_usage(customer_plan_id, appointment_id, service_id)
  WHERE appointment_id IS NOT NULL AND reversed_at IS NULL;

CREATE OR REPLACE FUNCTION public.consume_plan_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  svc record;
  bal record;
  stf_name text;
  usage_id uuid;
BEGIN
  IF NEW.status::text <> 'completed'
     OR OLD.status::text = 'completed'
     OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO stf_name FROM public.staff WHERE id = NEW.staff_id;
  FOR svc IN
    SELECT aps.service_id, s.name AS service_name
    FROM public.appointment_services aps
    JOIN public.services s ON s.id = aps.service_id
    WHERE aps.appointment_id = NEW.id
  LOOP
    -- O PDV pode ter reservado o crédito para este mesmo agendamento.
    IF EXISTS (
      SELECT 1 FROM public.plan_session_usage psu
      WHERE psu.appointment_id = NEW.id
        AND psu.service_id = svc.service_id
        AND psu.reversed_at IS NULL
    ) THEN
      CONTINUE;
    END IF;

    SELECT cps.* INTO bal
    FROM public.customer_plan_services cps
    JOIN public.customer_plans cp ON cp.id = cps.customer_plan_id
    WHERE cps.service_id = svc.service_id
      AND cp.customer_id = NEW.customer_id
      AND cp.company_id = NEW.company_id
      AND cp.status = 'active'
      AND (cp.expires_at IS NULL OR cp.expires_at >= CURRENT_DATE)
      AND cps.sessions_used < cps.sessions_total
    ORDER BY cp.expires_at NULLS LAST, cp.sold_at, cps.created_at
    LIMIT 1
    FOR UPDATE OF cps;
    IF NOT FOUND THEN CONTINUE; END IF;

    usage_id := NULL;
    INSERT INTO public.plan_session_usage(
      company_id, customer_plan_id, customer_id, service_id, service_name,
      appointment_id, staff_id, staff_name, quantity, actor_user_id
    ) VALUES (
      NEW.company_id, bal.customer_plan_id, NEW.customer_id, svc.service_id,
      svc.service_name, NEW.id, NEW.staff_id, stf_name, 1, auth.uid()
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO usage_id;

    IF usage_id IS NULL THEN CONTINUE; END IF;
    UPDATE public.customer_plan_services
    SET sessions_used = sessions_used + 1
    WHERE id = bal.id;

    INSERT INTO public.plan_audit_log(
      company_id, entity, entity_id, action, description, actor_user_id
    ) VALUES (
      NEW.company_id, 'session', bal.customer_plan_id, 'session_used',
      'Sessão consumida: ' || svc.service_name, auth.uid()
    );
  END LOOP;
  RETURN NEW;
END;
$$;

-- Classifica o lançamento pelo conteúdo real da venda.
CREATE OR REPLACE FUNCTION public.finalize_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it record;
  cust text;
  sale_category text;
  item_kinds integer;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN RETURN NEW; END IF;
  SELECT name INTO cust FROM public.customers WHERE id = NEW.customer_id;

  FOR it IN
    SELECT * FROM public.sale_items WHERE sale_id = NEW.id AND product_id IS NOT NULL
  LOOP
    INSERT INTO public.inventory_movements(
      company_id, product_id, type, quantity, unit_cost, reason, operation, sale_id, created_by
    ) VALUES (
      NEW.company_id, it.product_id, 'out', it.quantity, it.unit_cost,
      'Venda #' || substr(NEW.id::text, 1, 8) || COALESCE(' · ' || cust, ''),
      'venda', NEW.id, NEW.created_by
    );
  END LOOP;

  SELECT count(DISTINCT kind) INTO item_kinds
  FROM public.sale_items WHERE sale_id = NEW.id;
  IF item_kinds > 1 THEN
    sale_category := 'Venda mista';
  ELSIF EXISTS (SELECT 1 FROM public.sale_items WHERE sale_id = NEW.id AND kind = 'package') THEN
    sale_category := 'Planos e pacotes';
  ELSIF EXISTS (SELECT 1 FROM public.sale_items WHERE sale_id = NEW.id AND kind = 'service') THEN
    sale_category := 'Serviços';
  ELSE
    sale_category := 'Produtos';
  END IF;

  IF NEW.total_cents > 0 THEN
    INSERT INTO public.financial_transactions(
      company_id, type, category, description, amount, occurred_on,
      sale_id, staff_id, appointment_id, created_by
    ) VALUES (
      NEW.company_id, 'income', sale_category,
      'Venda #' || substr(NEW.id::text, 1, 8) || COALESCE(' · ' || cust, ''),
      NEW.total_cents / 100.0,
      (NEW.occurred_at AT TIME ZONE 'America/Sao_Paulo')::date,
      NEW.id, NEW.staff_id, NEW.appointment_id, NEW.created_by
    );
  END IF;

  INSERT INTO public.commerce_audit_log(
    company_id, entity, entity_id, action, description, actor_user_id
  ) VALUES (
    NEW.company_id, 'sale', NEW.id, 'sale_completed',
    'Venda finalizada · ' || to_char(NEW.total_cents / 100.0, 'FM999G990D00'), auth.uid()
  );
  RETURN NEW;
END;
$$;

-- Atualiza cadastro, função e vínculo profissional na mesma transação.
CREATE OR REPLACE FUNCTION public.sync_company_user_access(
  _company_id uuid,
  _user_id uuid,
  _role text,
  _job_title text,
  _permissions jsonb,
  _active boolean,
  _staff_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  membership_id uuid;
  old_staff_id uuid;
  normalized_role public.app_role;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_company_admin(_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar usuários desta empresa';
  END IF;
  IF _role NOT IN ('company_admin', 'staff', 'receptionist') THEN
    RAISE EXCEPTION 'Perfil de acesso inválido';
  END IF;
  normalized_role := _role::public.app_role;
  IF _role = 'staff' AND _staff_id IS NULL THEN
    RAISE EXCEPTION 'Selecione o profissional que utilizará este acesso';
  END IF;
  IF _role <> 'staff' THEN _staff_id := NULL; END IF;

  IF _staff_id IS NOT NULL THEN
    PERFORM 1 FROM public.staff
    WHERE id = _staff_id AND company_id = _company_id AND active
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Profissional inválido ou inativo'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = _company_id
        AND cu.staff_id = _staff_id
        AND cu.user_id <> _user_id
        AND cu.active
    ) THEN
      RAISE EXCEPTION 'Este profissional já possui um usuário de acesso ativo';
    END IF;
  END IF;

  SELECT id, staff_id INTO membership_id, old_staff_id
  FROM public.company_users
  WHERE company_id = _company_id AND user_id = _user_id
  FOR UPDATE;

  INSERT INTO public.company_users(
    company_id, user_id, role, job_title, permissions, active, staff_id
  ) VALUES (
    _company_id, _user_id, normalized_role, NULLIF(trim(_job_title), ''),
    COALESCE(_permissions, '{}'::jsonb), COALESCE(_active, true), _staff_id
  )
  ON CONFLICT (company_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    job_title = EXCLUDED.job_title,
    permissions = EXCLUDED.permissions,
    active = EXCLUDED.active,
    staff_id = EXCLUDED.staff_id
  RETURNING id INTO membership_id;

  IF old_staff_id IS NOT NULL AND old_staff_id IS DISTINCT FROM _staff_id THEN
    UPDATE public.staff SET user_id = NULL
    WHERE id = old_staff_id AND company_id = _company_id AND user_id = _user_id;
  END IF;
  IF _staff_id IS NOT NULL THEN
    UPDATE public.staff SET user_id = _user_id
    WHERE id = _staff_id AND company_id = _company_id;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role IN ('company_admin', 'staff', 'receptionist');
  INSERT INTO public.user_roles(user_id, role)
  VALUES (_user_id, normalized_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN membership_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_company_user_access(
  _company_id uuid,
  _membership_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_row record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_company_admin(_company_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerenciar usuários desta empresa';
  END IF;
  SELECT user_id, staff_id INTO member_row
  FROM public.company_users
  WHERE id = _membership_id AND company_id = _company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado nesta empresa'; END IF;

  IF member_row.staff_id IS NOT NULL THEN
    UPDATE public.staff SET user_id = NULL
    WHERE id = member_row.staff_id
      AND company_id = _company_id
      AND user_id = member_row.user_id;
  END IF;
  DELETE FROM public.company_users WHERE id = _membership_id AND company_id = _company_id;
  DELETE FROM public.user_roles
  WHERE user_id = member_row.user_id
    AND role IN ('company_admin', 'staff', 'receptionist')
    AND NOT EXISTS (
      SELECT 1 FROM public.company_users WHERE user_id = member_row.user_id AND active
    );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_company_user_access(uuid,uuid,text,text,jsonb,boolean,uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_company_user_access(uuid,uuid,text,text,jsonb,boolean,uuid)
TO authenticated;
REVOKE ALL ON FUNCTION public.remove_company_user_access(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_company_user_access(uuid,uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

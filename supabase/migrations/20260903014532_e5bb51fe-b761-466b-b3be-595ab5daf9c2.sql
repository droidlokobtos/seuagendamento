-- Programa de indicação entre empresas.
-- Uma recompensa é liberada no primeiro pagamento da indicada e apenas uma
-- recompensa pode ser consumida por cobrança da empresa indicadora.

CREATE TABLE IF NOT EXISTS public.company_referral_codes (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  referred_company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  referred_plan_code text REFERENCES public.subscription_plans(code),
  reward_percent numeric(5,2) CHECK (reward_percent IN (2, 5, 10)),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','qualified','applied','cancelled')),
  qualified_at timestamptz,
  applied_at timestamptz,
  qualifying_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  applied_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_referrals_no_self_referral CHECK (referrer_company_id <> referred_company_id)
);

CREATE INDEX IF NOT EXISTS company_referrals_queue_idx
  ON public.company_referrals (referrer_company_id, status, qualified_at, created_at);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS gross_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS referral_discount_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS referral_discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_id uuid REFERENCES public.company_referrals(id) ON DELETE SET NULL;

UPDATE public.payments SET gross_amount = amount WHERE gross_amount IS NULL;
ALTER TABLE public.payments ALTER COLUMN gross_amount SET NOT NULL;

GRANT SELECT ON public.company_referral_codes, public.company_referrals TO authenticated;
GRANT ALL ON public.company_referral_codes, public.company_referrals TO service_role;
ALTER TABLE public.company_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members read referral code" ON public.company_referral_codes;
CREATE POLICY "Company members read referral code" ON public.company_referral_codes
  FOR SELECT TO authenticated USING (
    public.is_super_admin() OR company_id IN (SELECT public.user_company_ids(auth.uid()))
  );

DROP POLICY IF EXISTS "Companies read their referrals" ON public.company_referrals;
CREATE POLICY "Companies read their referrals" ON public.company_referrals
  FOR SELECT TO authenticated USING (
    public.is_super_admin()
    OR referrer_company_id IN (SELECT public.user_company_ids(auth.uid()))
    OR referred_company_id IN (SELECT public.user_company_ids(auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.ensure_company_referral_code(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  generated text;
BEGIN
  SELECT code INTO generated FROM public.company_referral_codes WHERE company_id = _company_id;
  IF generated IS NOT NULL THEN RETURN generated; END IF;
  LOOP
    generated := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    BEGIN
      INSERT INTO public.company_referral_codes(company_id, code) VALUES (_company_id, generated);
      RETURN generated;
    EXCEPTION WHEN unique_violation THEN
      SELECT code INTO generated FROM public.company_referral_codes WHERE company_id = _company_id;
      IF generated IS NOT NULL THEN RETURN generated; END IF;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_company_referral_code_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.ensure_company_referral_code(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_referral_code ON public.companies;
CREATE TRIGGER trg_company_referral_code
AFTER INSERT ON public.companies FOR EACH ROW
EXECUTE FUNCTION public.create_company_referral_code_trigger();

SELECT public.ensure_company_referral_code(id) FROM public.companies;

CREATE OR REPLACE FUNCTION public.register_company_referral(_referred_company_id uuid, _referral_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer uuid;
  normalized text := upper(trim(_referral_code));
BEGIN
  IF NOT (public.is_super_admin() OR _referred_company_id IN (SELECT public.user_company_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT company_id INTO referrer FROM public.company_referral_codes WHERE code = normalized;
  IF referrer IS NULL THEN RAISE EXCEPTION 'Código de indicação inválido'; END IF;
  IF referrer = _referred_company_id THEN RAISE EXCEPTION 'Uma empresa não pode indicar a si mesma'; END IF;
  INSERT INTO public.company_referrals(referrer_company_id, referred_company_id, referral_code)
  VALUES (referrer, _referred_company_id, normalized)
  ON CONFLICT (referred_company_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'referrer_company_id', referrer);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_company_referral_dashboard(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT (public.is_super_admin() OR _company_id IN (SELECT public.user_company_ids(auth.uid()))) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  PERFORM public.ensure_company_referral_code(_company_id);
  SELECT jsonb_build_object(
    'code', (SELECT code FROM public.company_referral_codes WHERE company_id = _company_id),
    'summary', jsonb_build_object(
      'total', count(*),
      'pending', count(*) FILTER (WHERE r.status = 'pending'),
      'available', count(*) FILTER (WHERE r.status = 'qualified'),
      'applied', count(*) FILTER (WHERE r.status = 'applied')
    ),
    'referrals', COALESCE(jsonb_agg(jsonb_build_object(
      'id', r.id, 'company_name', c.name, 'plan_code', r.referred_plan_code,
      'reward_percent', r.reward_percent, 'status', r.status,
      'created_at', r.created_at, 'qualified_at', r.qualified_at, 'applied_at', r.applied_at
    ) ORDER BY r.created_at DESC) FILTER (WHERE r.id IS NOT NULL), '[]'::jsonb)
  ) INTO result
  FROM public.company_referrals r
  JOIN public.companies c ON c.id = r.referred_company_id
  WHERE r.referrer_company_id = _company_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_referral_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'total', count(*), 'pending', count(*) FILTER (WHERE r.status='pending'),
      'available', count(*) FILTER (WHERE r.status='qualified'),
      'applied', count(*) FILTER (WHERE r.status='applied'),
      'cancelled', count(*) FILTER (WHERE r.status='cancelled')
    ),
    'referrals', COALESCE(jsonb_agg(jsonb_build_object(
      'id', r.id, 'referrer_company_id', r.referrer_company_id,
      'referred_company_id', r.referred_company_id,
      'referrer_name', a.name, 'referred_name', b.name,
      'plan_code', r.referred_plan_code, 'reward_percent', r.reward_percent,
      'status', r.status, 'created_at', r.created_at, 'qualified_at', r.qualified_at,
      'applied_at', r.applied_at, 'cancel_reason', r.cancel_reason
    ) ORDER BY r.created_at DESC) FILTER (WHERE r.id IS NOT NULL), '[]'::jsonb)
  ) INTO result
  FROM public.company_referrals r
  JOIN public.companies a ON a.id = r.referrer_company_id
  JOIN public.companies b ON b.id = r.referred_company_id;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_referral_status(_referral_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF _status NOT IN ('pending','qualified','cancelled') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  IF _status = 'qualified' AND NOT EXISTS (
    SELECT 1 FROM public.company_referrals WHERE id = _referral_id AND reward_percent IS NOT NULL
  ) THEN RAISE EXCEPTION 'A recompensa ainda não possui percentual definido'; END IF;
  UPDATE public.company_referrals SET
    status = _status,
    cancelled_at = CASE WHEN _status='cancelled' THEN now() ELSE NULL END,
    cancel_reason = CASE WHEN _status='cancelled' THEN nullif(trim(_reason),'') ELSE NULL END,
    qualified_at = CASE WHEN _status='qualified' THEN COALESCE(qualified_at,now()) ELSE qualified_at END
  WHERE id = _referral_id AND status <> 'applied';
END;
$$;

CREATE OR REPLACE FUNCTION public.register_subscription_payment(
  _company_id uuid, _gross_amount numeric, _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  company_row public.companies%ROWTYPE;
  reward public.company_referrals%ROWTYPE;
  payment_id uuid;
  discount_amount numeric(10,2) := 0;
  net_amount numeric(10,2);
  has_prior boolean;
  reward_pct numeric(5,2);
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF _gross_amount <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  SELECT * INTO company_row FROM public.companies WHERE id=_company_id FOR UPDATE;
  IF company_row.id IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.payments WHERE company_id=_company_id) INTO has_prior;

  SELECT * INTO reward FROM public.company_referrals
  WHERE referrer_company_id=_company_id AND status='qualified'
  ORDER BY qualified_at NULLS LAST, created_at, id LIMIT 1 FOR UPDATE;
  IF reward.id IS NOT NULL THEN
    discount_amount := round(_gross_amount * reward.reward_percent / 100, 2);
  END IF;
  net_amount := greatest(0, _gross_amount - discount_amount);

  INSERT INTO public.payments(company_id, amount, gross_amount, referral_discount_percent,
    referral_discount_amount, referral_id, paid_at, note, created_by)
  VALUES (_company_id, net_amount, _gross_amount, reward.reward_percent, discount_amount,
    reward.id, current_date, nullif(trim(_note),''), auth.uid()) RETURNING id INTO payment_id;

  IF reward.id IS NOT NULL THEN
    UPDATE public.company_referrals SET status='applied', applied_at=now(), applied_payment_id=payment_id
    WHERE id=reward.id;
  END IF;

  IF NOT has_prior AND company_row.plan_code IN ('basic','business','pro') THEN
    reward_pct := CASE company_row.plan_code WHEN 'basic' THEN 2 WHEN 'business' THEN 5 WHEN 'pro' THEN 10 END;
    UPDATE public.company_referrals SET status='qualified', reward_percent=reward_pct,
      referred_plan_code=company_row.plan_code, qualified_at=now(), qualifying_payment_id=payment_id
    WHERE referred_company_id=_company_id AND status='pending';
  END IF;

  UPDATE public.companies SET
    last_payment_at=current_date,
    next_due_at=(COALESCE(next_due_at,current_date) + interval '1 month')::date
  WHERE id=_company_id;

  RETURN jsonb_build_object('id',payment_id,'amount',net_amount,'gross_amount',_gross_amount,
    'discount_percent',reward.reward_percent,'discount_amount',discount_amount,
    'paid_at',current_date,'note',nullif(trim(_note),''));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_company_referral_code(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_company_referral(uuid,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_company_referral_dashboard(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_referral_dashboard() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_referral_status(uuid,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_subscription_payment(uuid,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_company_referral(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_referral_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_referral_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_referral_status(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_subscription_payment(uuid,numeric,text) TO authenticated;
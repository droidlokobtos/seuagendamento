-- Faz cada pagamento renovar a assinatura pela duração contratada no Admin Master.
CREATE OR REPLACE FUNCTION public.register_subscription_payment(
  _company_id uuid,
  _gross_amount numeric,
  _note text DEFAULT NULL
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
  contracted_months integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF _gross_amount <= 0 THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;

  SELECT * INTO company_row
  FROM public.companies
  WHERE id = _company_id
  FOR UPDATE;

  IF company_row.id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  contracted_months := CASE
    WHEN company_row.plan_cycle_months IN (1, 3, 6, 12) THEN company_row.plan_cycle_months
    ELSE 1
  END;

  SELECT EXISTS(
    SELECT 1 FROM public.payments WHERE company_id = _company_id
  ) INTO has_prior;

  SELECT * INTO reward
  FROM public.company_referrals
  WHERE referrer_company_id = _company_id
    AND status = 'qualified'
  ORDER BY qualified_at NULLS LAST, created_at, id
  LIMIT 1
  FOR UPDATE;

  IF reward.id IS NOT NULL THEN
    discount_amount := round(_gross_amount * reward.reward_percent / 100, 2);
  END IF;
  net_amount := greatest(0, _gross_amount - discount_amount);

  INSERT INTO public.payments(
    company_id,
    amount,
    gross_amount,
    referral_discount_percent,
    referral_discount_amount,
    referral_id,
    paid_at,
    note,
    created_by
  )
  VALUES (
    _company_id,
    net_amount,
    _gross_amount,
    reward.reward_percent,
    discount_amount,
    reward.id,
    current_date,
    nullif(trim(_note), ''),
    auth.uid()
  )
  RETURNING id INTO payment_id;

  IF reward.id IS NOT NULL THEN
    UPDATE public.company_referrals
    SET status = 'applied',
        applied_at = now(),
        applied_payment_id = payment_id
    WHERE id = reward.id;
  END IF;

  IF NOT has_prior AND company_row.plan_code IN ('basic', 'business', 'pro') THEN
    reward_pct := CASE company_row.plan_code
      WHEN 'basic' THEN 2
      WHEN 'business' THEN 5
      WHEN 'pro' THEN 10
    END;

    UPDATE public.company_referrals
    SET status = 'qualified',
        reward_percent = reward_pct,
        referred_plan_code = company_row.plan_code,
        qualified_at = now(),
        qualifying_payment_id = payment_id
    WHERE referred_company_id = _company_id
      AND status = 'pending';
  END IF;

  UPDATE public.companies
  SET last_payment_at = current_date,
      next_due_at = (
        greatest(coalesce(next_due_at, current_date), current_date)
        + make_interval(months => contracted_months)
      )::date
  WHERE id = _company_id;

  RETURN jsonb_build_object(
    'id', payment_id,
    'amount', net_amount,
    'gross_amount', _gross_amount,
    'discount_percent', reward.reward_percent,
    'discount_amount', discount_amount,
    'cycle_months', contracted_months,
    'paid_at', current_date,
    'note', nullif(trim(_note), '')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_subscription_payment(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_subscription_payment(uuid, numeric, text) TO authenticated;

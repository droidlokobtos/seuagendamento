-- RPCs financeiras antigas validavam somente associação à empresa. As fachadas
-- abaixo aplicam as permissões granulares antes de executar a operação original.

CREATE OR REPLACE FUNCTION public.mark_business_expense_paid_authorized(
  p_expense_id uuid,
  p_payment_method_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id
  FROM public.business_expenses
  WHERE id = p_expense_id;

  IF v_company_id IS NULL OR NOT public.has_any_permission(v_company_id, ARRAY['financeiro']) THEN
    RAISE EXCEPTION 'Sem permissão financeira para esta empresa';
  END IF;

  RETURN public.mark_business_expense_paid(p_expense_id, p_payment_method_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_appointment_with_products_authorized(
  _appointment_id uuid,
  _products jsonb,
  _payment_kind text,
  _payment_amount_cents integer,
  _payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id
  FROM public.appointments
  WHERE id = _appointment_id;

  IF v_company_id IS NULL
     OR NOT public.has_any_permission(v_company_id, ARRAY['caixa', 'financeiro'])
     OR NOT public.has_any_permission(v_company_id, ARRAY['estoque']) THEN
    RAISE EXCEPTION 'Sem permissão para concluir pagamento com produtos';
  END IF;

  RETURN public.checkout_appointment_with_products(
    _appointment_id,
    _products,
    _payment_kind,
    _payment_amount_cents,
    _payment_method
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_business_expense_paid(uuid, uuid) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.checkout_appointment_with_products(uuid, jsonb, text, integer, text) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.mark_business_expense_paid_authorized(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkout_appointment_with_products_authorized(uuid, jsonb, text, integer, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.mark_business_expense_paid(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkout_appointment_with_products(uuid, jsonb, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_business_expense_paid_authorized(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.checkout_appointment_with_products_authorized(uuid, jsonb, text, integer, text) TO authenticated, service_role;

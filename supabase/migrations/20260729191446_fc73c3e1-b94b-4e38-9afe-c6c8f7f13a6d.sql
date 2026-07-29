CREATE OR REPLACE FUNCTION public.validate_coupon(_company uuid, _code text, _subtotal_cents integer)
 RETURNS TABLE(id uuid, code text, discount_type text, discount_value numeric, discount_cents integer, message text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c record;
  d integer := 0;
BEGIN
  SELECT cp.* INTO c FROM public.coupons cp
    WHERE cp.company_id = _company
      AND upper(cp.code) = upper(_code)
      AND cp.active = true
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, _code, NULL::text, NULL::numeric, 0, 'Cupom inválido';
    RETURN;
  END IF;

  IF c.valid_from IS NOT NULL AND c.valid_from > now() THEN
    RETURN QUERY SELECT c.id, c.code, c.discount_type, c.discount_value, 0, 'Cupom ainda não válido'; RETURN;
  END IF;
  IF c.valid_until IS NOT NULL AND c.valid_until < now() THEN
    RETURN QUERY SELECT c.id, c.code, c.discount_type, c.discount_value, 0, 'Cupom expirado'; RETURN;
  END IF;
  IF c.usage_limit IS NOT NULL AND c.used_count >= c.usage_limit THEN
    RETURN QUERY SELECT c.id, c.code, c.discount_type, c.discount_value, 0, 'Cupom esgotado'; RETURN;
  END IF;
  IF c.min_purchase_cents IS NOT NULL AND _subtotal_cents < c.min_purchase_cents THEN
    RETURN QUERY SELECT c.id, c.code, c.discount_type, c.discount_value, 0, 'Valor mínimo não atingido'; RETURN;
  END IF;

  IF c.discount_type = 'percent' THEN
    d := (_subtotal_cents * c.discount_value / 100)::integer;
  ELSE
    d := (c.discount_value * 100)::integer;
  END IF;
  IF d > _subtotal_cents THEN d := _subtotal_cents; END IF;

  RETURN QUERY SELECT c.id, c.code, c.discount_type, c.discount_value, d, 'ok';
END; $function$;

REVOKE EXECUTE ON FUNCTION public.validate_coupon(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_coupon(uuid, text, integer) TO service_role;
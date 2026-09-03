-- Make referral-code creation explicit and recoverable from the company panel.
-- The function is idempotent and only accepts companies the current user can access.

CREATE OR REPLACE FUNCTION public.get_or_create_company_referral_code(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  generated_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT (
    public.is_super_admin()
    OR _company_id IN (SELECT public.user_company_ids(auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id) THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  generated_code := public.ensure_company_referral_code(_company_id);

  IF generated_code IS NULL OR generated_code = '' THEN
    RAISE EXCEPTION 'Não foi possível gerar o código de indicação';
  END IF;

  RETURN generated_code;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_company_referral_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_company_referral_code(uuid) TO authenticated;

-- Repair codes for companies that existed before the referral migration or
-- whose trigger did not run during a previous deployment.
SELECT public.ensure_company_referral_code(id)
FROM public.companies
WHERE NOT EXISTS (
  SELECT 1
  FROM public.company_referral_codes crc
  WHERE crc.company_id = companies.id
);

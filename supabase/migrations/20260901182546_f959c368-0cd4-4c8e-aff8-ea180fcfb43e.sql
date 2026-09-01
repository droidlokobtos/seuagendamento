-- 1) View public_companies: SECURITY DEFINER -> invoker
ALTER VIEW public.public_companies SET (security_invoker = true);

-- 2) search_path fixo em funcoes sem configuracao
ALTER FUNCTION public.prevent_company_appointment_overlap() SET search_path = public;

-- 3) Nenhuma funcao SECURITY DEFINER executavel anonimamente
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prokind = 'f'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, public', f.proname, f.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', f.proname, f.args);
  END LOOP;
END $$;

-- 4) reviews: anon deixa de ler ip/user_agent e demais colunas sensiveis
REVOKE SELECT ON public.reviews FROM anon;
GRANT SELECT (id, company_id, appointment_id, customer_id, staff_id,
              rating, staff_rating, comment, service_names, published,
              customer_name, created_at)
  ON public.reviews TO anon;
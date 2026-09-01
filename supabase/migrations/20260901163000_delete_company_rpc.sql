CREATE OR REPLACE FUNCTION public.delete_company_as_super_admin(_company uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_company public.companies%ROWTYPE;
  v_child_count integer;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Apenas Admin Master pode excluir empresas.';
  END IF;

  SELECT * INTO v_company
  FROM public.companies
  WHERE id = _company;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  SELECT count(*) INTO v_child_count
  FROM public.companies
  WHERE parent_company_id = _company;

  IF v_child_count > 0 THEN
    RAISE EXCEPTION 'Não é possível excluir: existem % unidade(s) vinculada(s) a esta empresa. Remova ou desvincule-as antes.', v_child_count;
  END IF;

  INSERT INTO public.admin_access_logs(user_id, email, event, metadata)
  VALUES (
    auth.uid(),
    NULL,
    'delete_company',
    jsonb_build_object('company_id', v_company.id, 'company_name', v_company.name)
  );

  DELETE FROM public.companies
  WHERE id = _company;

  RETURN jsonb_build_object(
    'ok', true,
    'company_id', v_company.id,
    'company_name', v_company.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_company_as_super_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_company_as_super_admin(uuid) TO authenticated;

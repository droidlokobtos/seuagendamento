CREATE OR REPLACE FUNCTION public.create_company_for_user_as_super_admin(
  _user_id uuid,
  _name text,
  _owner_name text,
  _slug text,
  _niche_id uuid,
  _sub_niche_id uuid,
  _email text,
  _phone text,
  _monthly_fee numeric,
  _contracted_plan text,
  _status public.company_status,
  _next_due_at date,
  _admin_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Apenas Admin Master pode criar empresas.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuário de autenticação não encontrado.';
  END IF;

  INSERT INTO public.profiles(id, full_name, phone, must_change_password)
  VALUES (_user_id, _owner_name, _phone, false)
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone;

  INSERT INTO public.companies(
    name, slug, niche_id, sub_niche_id, email,
    owner_name, responsible_name, owner_whatsapp,
    monthly_fee, phone, whatsapp, contracted_plan,
    status, next_due_at, admin_notes
  )
  VALUES (
    _name, _slug, _niche_id, _sub_niche_id, lower(_email),
    _owner_name, _owner_name, _phone,
    _monthly_fee, _phone, _phone, _contracted_plan,
    _status, _next_due_at, _admin_notes
  )
  RETURNING id INTO v_company_id;

  INSERT INTO public.company_users(company_id, user_id, role, active, permissions)
  VALUES (v_company_id, _user_id, 'company_admin', true, '{}'::jsonb)
  ON CONFLICT (company_id, user_id) DO UPDATE
  SET role = 'company_admin', active = true;

  INSERT INTO public.user_roles(user_id, role)
  VALUES (_user_id, 'company_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.admin_access_logs(user_id, email, event, metadata)
  VALUES (
    auth.uid(), lower(_email), 'create_company',
    jsonb_build_object('company_id', v_company_id, 'admin_user_id', _user_id, 'method', 'public_signup_plus_secure_rpc')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'company_id', v_company_id,
    'admin_user_id', _user_id,
    'email', lower(_email)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_company_for_user_as_super_admin(
  uuid,text,text,text,uuid,uuid,text,text,numeric,text,public.company_status,date,text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_company_for_user_as_super_admin(
  uuid,text,text,text,uuid,uuid,text,text,numeric,text,public.company_status,date,text
) TO authenticated;

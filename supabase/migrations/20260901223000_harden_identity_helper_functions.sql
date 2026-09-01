-- Funções SECURITY DEFINER não podem servir como canal de enumeração de
-- cargos ou associações de outros usuários.

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when _user_id = auth.uid()
      or exists (
        select 1 from public.user_roles admin_role
        where admin_role.user_id = auth.uid()
          and admin_role.role = 'super_admin'
      )
    then exists (
      select 1 from public.user_roles requested_role
      where requested_role.user_id = _user_id
        and requested_role.role = _role
    )
    else false
  end
$$;

create or replace function public.user_company_ids(_user_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select cu.company_id
  from public.company_users cu
  where cu.user_id = _user_id
    and cu.active = true
    and (
      _user_id = auth.uid()
      or exists (
        select 1 from public.user_roles admin_role
        where admin_role.user_id = auth.uid()
          and admin_role.role = 'super_admin'
      )
    )
$$;

revoke all on function public.has_role(uuid, public.app_role) from public, anon;
revoke all on function public.user_company_ids(uuid) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.user_company_ids(uuid) to authenticated, service_role;


ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receptionist';

-- Helper: is caller a company_admin of a given company?
CREATE OR REPLACE FUNCTION public.is_company_admin(_company uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE user_id = auth.uid()
      AND company_id = _company
      AND role = 'company_admin'
  ) OR public.is_super_admin();
$$;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated;

-- Allow company_admin to manage members of their company
DROP POLICY IF EXISTS "Company admin manages members" ON public.company_users;
CREATE POLICY "Company admin manages members" ON public.company_users
  FOR ALL TO authenticated
  USING (public.is_company_admin(company_id))
  WITH CHECK (public.is_company_admin(company_id));

-- Allow company members to see other members of same company
DROP POLICY IF EXISTS "Members see company roster" ON public.company_users;
CREATE POLICY "Members see company roster" ON public.company_users
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

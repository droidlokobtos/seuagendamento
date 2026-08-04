
ALTER TABLE public.company_users
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_company_users_updated ON public.company_users;
CREATE TRIGGER trg_company_users_updated
  BEFORE UPDATE ON public.company_users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Membership only counts for active users
CREATE OR REPLACE FUNCTION public.is_company_member(_company uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = _company
      AND cu.user_id = auth.uid()
      AND cu.active
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_company uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = _company
      AND cu.user_id = auth.uid()
      AND cu.active
      AND cu.role = 'company_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.user_company_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.company_users
  WHERE user_id = _user_id AND active
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_company uuid, _key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = _company
      AND cu.user_id = auth.uid()
      AND cu.active
      AND (cu.role = 'company_admin' OR COALESCE((cu.permissions ->> _key)::boolean, false))
  )
$$;

CREATE TABLE IF NOT EXISTS public.user_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid,
  actor_email text,
  action text NOT NULL,
  entity text,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.user_audit_log TO authenticated;
GRANT ALL ON public.user_audit_log TO service_role;

ALTER TABLE public.user_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit insert by members" ON public.user_audit_log;
CREATE POLICY "audit insert by members" ON public.user_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_company_member(company_id));

DROP POLICY IF EXISTS "audit read by admins" ON public.user_audit_log;
CREATE POLICY "audit read by admins" ON public.user_audit_log
  FOR SELECT TO authenticated
  USING (public.is_company_admin(company_id) OR user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_audit_company_created
  ON public.user_audit_log (company_id, created_at DESC);

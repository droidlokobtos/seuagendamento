CREATE OR REPLACE FUNCTION public.can_access_appointment(_company uuid, _staff uuid, _keys text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.company_id = _company
      AND cu.user_id = auth.uid()
      AND cu.active
      AND (
        cu.role = 'company_admin'
        OR (cu.role = 'staff' AND cu.staff_id IS NOT NULL AND cu.staff_id = _staff AND EXISTS (
          SELECT 1 FROM unnest(_keys) AS k WHERE COALESCE((cu.permissions ->> k)::boolean, false)
        ))
        OR (cu.role <> 'staff' AND EXISTS (
          SELECT 1 FROM unnest(_keys) AS k WHERE COALESCE((cu.permissions ->> k)::boolean, false)
        ))
      )
  )
$$;
REVOKE ALL ON FUNCTION public.can_access_appointment(uuid, uuid, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_appointment(uuid, uuid, text[]) TO authenticated, service_role;

DROP POLICY IF EXISTS "permission scoped access" ON public.appointments;
CREATE POLICY "permission scoped appointments"
ON public.appointments FOR ALL TO authenticated
USING (public.can_access_appointment(company_id, staff_id, ARRAY['agenda','agendamentos']))
WITH CHECK (public.can_access_appointment(company_id, staff_id, ARRAY['agenda','agendamentos']));

DROP POLICY IF EXISTS "permission scoped access" ON public.time_blocks;
CREATE POLICY "permission scoped time blocks"
ON public.time_blocks FOR ALL TO authenticated
USING (public.can_access_appointment(company_id, staff_id, ARRAY['agenda']))
WITH CHECK (public.can_access_appointment(company_id, staff_id, ARRAY['agenda']));

DROP POLICY IF EXISTS "permission scoped access" ON public.commissions;
CREATE POLICY "permission scoped commissions"
ON public.commissions FOR ALL TO authenticated
USING (
  public.is_super_admin()
  OR public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = commissions.company_id
      AND cu.user_id = auth.uid() AND cu.active
      AND COALESCE((cu.permissions ->> 'comissoes')::boolean, false)
      AND (cu.role <> 'staff' OR cu.staff_id = commissions.staff_id)
  )
)
WITH CHECK (
  public.is_super_admin()
  OR public.is_company_admin(company_id)
  OR EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = commissions.company_id
      AND cu.user_id = auth.uid() AND cu.active
      AND COALESCE((cu.permissions ->> 'comissoes')::boolean, false)
      AND (cu.role <> 'staff' OR cu.staff_id = commissions.staff_id)
  )
);

CREATE POLICY "internal appointment services by permission"
ON public.appointment_services FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.appointments a
  WHERE a.id = appointment_services.appointment_id
    AND public.can_access_appointment(a.company_id, a.staff_id, ARRAY['agenda','agendamentos'])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.appointments a
  WHERE a.id = appointment_services.appointment_id
    AND public.can_access_appointment(a.company_id, a.staff_id, ARRAY['agenda','agendamentos'])
));

CREATE POLICY "staff schedules by permission"
ON public.staff_schedules FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.staff s
  WHERE s.id = staff_schedules.staff_id
    AND (
      public.has_any_permission(s.company_id, ARRAY['configuracoes','agenda'])
      AND (
        NOT EXISTS (SELECT 1 FROM public.company_users cu WHERE cu.company_id=s.company_id AND cu.user_id=auth.uid() AND cu.active AND cu.role='staff')
        OR EXISTS (SELECT 1 FROM public.company_users cu WHERE cu.company_id=s.company_id AND cu.user_id=auth.uid() AND cu.active AND cu.role='staff' AND cu.staff_id=s.id)
      )
    )
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.staff s
  WHERE s.id = staff_schedules.staff_id
    AND public.has_any_permission(s.company_id, ARRAY['configuracoes','agenda'])
));

CREATE POLICY "internal staff services by permission"
ON public.staff_services FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.staff s
  WHERE s.id = staff_services.staff_id
    AND public.has_any_permission(s.company_id, ARRAY['configuracoes','servicos','agenda'])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.staff s
  WHERE s.id = staff_services.staff_id
    AND public.has_any_permission(s.company_id, ARRAY['configuracoes','servicos'])
));

NOTIFY pgrst, 'reload schema';
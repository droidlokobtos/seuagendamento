
-- Public read of company profile (safe columns only; RLS applies to the whole row,
-- but we restrict the app to selecting non-sensitive columns via the query).
GRANT SELECT ON public.companies TO anon;
CREATE POLICY "Public read active company" ON public.companies
  FOR SELECT TO anon
  USING (status IN ('active','due_soon','overdue'));

GRANT SELECT ON public.services TO anon;
CREATE POLICY "Public read active services" ON public.services
  FOR SELECT TO anon
  USING (active = true);

GRANT SELECT ON public.staff TO anon;
CREATE POLICY "Public read active staff" ON public.staff
  FOR SELECT TO anon
  USING (active = true);

GRANT SELECT ON public.staff_services TO anon;
CREATE POLICY "Public read staff services" ON public.staff_services
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_services.staff_id AND s.active = true));

GRANT SELECT ON public.company_hours TO anon;
CREATE POLICY "Public read company hours" ON public.company_hours
  FOR SELECT TO anon
  USING (true);

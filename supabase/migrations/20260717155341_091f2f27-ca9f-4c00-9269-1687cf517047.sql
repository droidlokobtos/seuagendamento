
-- Enums
CREATE TYPE public.appointment_status AS ENUM ('scheduled','confirmed','in_progress','completed','cancelled','no_show');
CREATE TYPE public.payment_method_kind AS ENUM ('cash','pix','credit_card','debit_card','bank_transfer','other');

-- Helper: membership check
CREATE OR REPLACE FUNCTION public.is_company_member(_company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE user_id = auth.uid() AND company_id = _company
  ) OR public.is_super_admin();
$$;

-- services
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_min int NOT NULL DEFAULT 30,
  price_cents int NOT NULL DEFAULT 0,
  category text,
  color text DEFAULT '#8b7355',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svc member read" ON public.services FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "svc member write" ON public.services FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER services_touch BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- staff
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  email text,
  role_title text,
  color text DEFAULT '#8b7355',
  commission_pct numeric(5,2) DEFAULT 0,
  photo_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff member read" ON public.staff FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "staff member write" ON public.staff FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER staff_touch BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- staff_services (junction)
CREATE TABLE public.staff_services (
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  PRIMARY KEY (staff_id, service_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_services TO authenticated;
GRANT ALL ON public.staff_services TO service_role;
ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ss member read" ON public.staff_services FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND public.is_company_member(s.company_id)));
CREATE POLICY "ss member write" ON public.staff_services FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND public.is_company_member(s.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND public.is_company_member(s.company_id)));

-- staff_schedules
CREATE TABLE public.staff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_schedules TO authenticated;
GRANT ALL ON public.staff_schedules TO service_role;
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ssch member read" ON public.staff_schedules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND public.is_company_member(s.company_id)));
CREATE POLICY "ssch member write" ON public.staff_schedules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND public.is_company_member(s.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.id = staff_id AND public.is_company_member(s.company_id)));

-- customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  birthdate date,
  notes text,
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cust member read" ON public.customers FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "cust member write" ON public.customers FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE INDEX customers_company_idx ON public.customers(company_id);
CREATE TRIGGER customers_touch BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- appointments
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  total_cents int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appt member read" ON public.appointments FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "appt member write" ON public.appointments FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE INDEX appt_company_starts_idx ON public.appointments(company_id, starts_at);
CREATE INDEX appt_staff_starts_idx ON public.appointments(staff_id, starts_at);
CREATE TRIGGER appointments_touch BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- appointment_services
CREATE TABLE public.appointment_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  price_cents int NOT NULL DEFAULT 0,
  duration_min int NOT NULL DEFAULT 30
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_services TO authenticated;
GRANT ALL ON public.appointment_services TO service_role;
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aps member read" ON public.appointment_services FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND public.is_company_member(a.company_id)));
CREATE POLICY "aps member write" ON public.appointment_services FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND public.is_company_member(a.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = appointment_id AND public.is_company_member(a.company_id)));

-- company_hours
CREATE TABLE public.company_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '18:00',
  closed boolean NOT NULL DEFAULT false,
  UNIQUE (company_id, weekday)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_hours TO authenticated;
GRANT ALL ON public.company_hours TO service_role;
ALTER TABLE public.company_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ch member read" ON public.company_hours FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "ch member write" ON public.company_hours FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

-- payment_methods
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  method public.payment_method_kind NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE (company_id, method)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pm member read" ON public.payment_methods FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "pm member write" ON public.payment_methods FOR ALL TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

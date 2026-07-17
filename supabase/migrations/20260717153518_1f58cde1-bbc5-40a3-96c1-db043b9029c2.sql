
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'company_admin', 'staff', 'customer');
CREATE TYPE public.company_status AS ENUM ('active', 'due_soon', 'overdue', 'suspended');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

-- Now super_admin policy on user_roles
CREATE POLICY "Super admin manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ============ NICHES ============
CREATE TABLE public.niches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  primary_color TEXT NOT NULL DEFAULT '#0f172a',
  logo_url TEXT,
  banner_url TEXT,
  icon TEXT,
  suggested_services JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.niches TO authenticated;
GRANT ALL ON public.niches TO service_role;
ALTER TABLE public.niches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read niches" ON public.niches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin manages niches" ON public.niches FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_id UUID REFERENCES public.niches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  legal_name TEXT,
  document TEXT,
  responsible_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  address TEXT,
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0f172a',
  secondary_color TEXT NOT NULL DEFAULT '#c9a86a',
  theme TEXT NOT NULL DEFAULT 'light',
  status company_status NOT NULL DEFAULT 'active',
  monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 49.90,
  due_day SMALLINT NOT NULL DEFAULT 10 CHECK (due_day BETWEEN 1 AND 28),
  last_payment_at DATE,
  next_due_at DATE,
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ============ COMPANY_USERS ============
CREATE TABLE public.company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'company_admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_users TO authenticated;
GRANT ALL ON public.company_users TO service_role;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- Helper to get current user's company ids
CREATE OR REPLACE FUNCTION public.user_company_ids(_user_id UUID)
RETURNS SETOF UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.company_users WHERE user_id = _user_id;
$$;

CREATE POLICY "Super admin manages company_users" ON public.company_users FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "User sees own memberships" ON public.company_users FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Company policies
CREATE POLICY "Super admin manages companies" ON public.companies FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Members read own company" ON public.companies FOR SELECT TO authenticated
  USING (id IN (SELECT public.user_company_ids(auth.uid())));
CREATE POLICY "Company admin updates own company" ON public.companies FOR UPDATE TO authenticated
  USING (id IN (SELECT public.user_company_ids(auth.uid())) AND public.has_role(auth.uid(), 'company_admin'));

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admin manages payments" ON public.payments FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "Company members read own payments" ON public.payments FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.user_company_ids(auth.uid())));

-- ============ PLATFORM_SETTINGS (singleton) ============
CREATE TABLE public.platform_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  pix_key TEXT,
  pix_bank TEXT,
  pix_holder TEXT,
  platform_name TEXT NOT NULL DEFAULT 'BeautySaaS',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone auth reads settings" ON public.platform_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin writes settings" ON public.platform_settings FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
INSERT INTO public.platform_settings (id) VALUES (true);

-- ============ UPDATED_AT TRIGGERS ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_niches_updated BEFORE UPDATE ON public.niches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_platform_settings_updated BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ HANDLE NEW USER: create profile + first user becomes super_admin ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ COMPUTE COMPANY STATUS TRIGGER ============
CREATE OR REPLACE FUNCTION public.compute_company_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.suspended_at IS NOT NULL THEN
    NEW.status := 'suspended';
  ELSIF NEW.next_due_at IS NULL THEN
    NEW.status := 'active';
  ELSIF NEW.next_due_at < CURRENT_DATE THEN
    NEW.status := 'overdue';
  ELSIF NEW.next_due_at <= CURRENT_DATE + INTERVAL '7 days' THEN
    NEW.status := 'due_soon';
  ELSE
    NEW.status := 'active';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_companies_status BEFORE INSERT OR UPDATE OF next_due_at, suspended_at ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.compute_company_status();

-- Seed default niches
INSERT INTO public.niches (name, primary_color, suggested_services) VALUES
  ('Barbearia', '#1e293b', '["Corte masculino","Barba","Pigmentação","Sobrancelha"]'::jsonb),
  ('Manicure e Pedicure', '#c9a86a', '["Mão","Pé","Fibra","Gel"]'::jsonb),
  ('Design de Sobrancelhas', '#7c3aed', '["Design simples","Henna","Micropigmentação"]'::jsonb),
  ('Salão de Beleza', '#be185d', '["Corte","Escova","Progressiva","Coloração"]'::jsonb);

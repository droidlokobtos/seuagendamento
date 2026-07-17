
-- 1. Vínculo customers <-> auth.users
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS customers_company_user_uniq
  ON public.customers(company_id, user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS customers_user_id_idx
  ON public.customers(user_id) WHERE user_id IS NOT NULL;

-- 2. RLS: cliente autenticado enxerga/edita a própria linha em customers
DROP POLICY IF EXISTS "Customer sees own customer row" ON public.customers;
CREATE POLICY "Customer sees own customer row" ON public.customers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Customer updates own customer row" ON public.customers;
CREATE POLICY "Customer updates own customer row" ON public.customers
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. RLS: cliente vê e cancela os próprios agendamentos
DROP POLICY IF EXISTS "Customer sees own appointments" ON public.appointments;
CREATE POLICY "Customer sees own appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Customer cancels own future appointment" ON public.appointments;
CREATE POLICY "Customer cancels own future appointment" ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    AND starts_at > now() + interval '2 hours'
    AND status IN ('scheduled','confirmed')
  )
  WITH CHECK (
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
    AND status = 'cancelled'
  );

-- 4. RLS: cliente vê os serviços de seus agendamentos
DROP POLICY IF EXISTS "Customer sees own appointment services" ON public.appointment_services;
CREATE POLICY "Customer sees own appointment services" ON public.appointment_services
  FOR SELECT TO authenticated
  USING (appointment_id IN (
    SELECT id FROM public.appointments
    WHERE customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  ));

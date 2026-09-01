-- Permite ao administrador manter um serviço ativo internamente,
-- mas ocultá-lo do link público de agendamento.

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS show_on_booking boolean NOT NULL DEFAULT true;

-- Portal público anônimo: somente serviços ativos e marcados para exibição.
DROP POLICY IF EXISTS "Public reads active services of active companies" ON public.services;
CREATE POLICY "Public reads active services of active companies"
  ON public.services FOR SELECT TO anon
  USING (
    active
    AND show_on_booking
    AND EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = services.company_id
        AND c.status <> 'suspended'::company_status
    )
  );

-- Clientes autenticados no portal também podem visualizar somente serviços
-- públicos. As políticas já existentes para membros da empresa continuam
-- permitindo que administradores/funcionários vejam todos os serviços.
DROP POLICY IF EXISTS "Authenticated public reads visible services" ON public.services;
CREATE POLICY "Authenticated public reads visible services"
  ON public.services FOR SELECT TO authenticated
  USING (
    active
    AND show_on_booking
    AND EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = services.company_id
        AND c.status <> 'suspended'::company_status
    )
  );

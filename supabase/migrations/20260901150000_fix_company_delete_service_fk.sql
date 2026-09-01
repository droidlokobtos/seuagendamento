-- Preserve appointment history while allowing a company to be permanently deleted.
-- appointment_services belongs to appointments, and appointments already cascade from companies.
-- RESTRICT on service_id makes PostgreSQL try to delete services before the appointment cascade
-- can remove appointment_services, blocking company deletion. CASCADE is safe here because
-- deleting a service must also remove only its junction rows, not the appointments themselves.

ALTER TABLE public.appointment_services
  DROP CONSTRAINT IF EXISTS appointment_services_service_id_fkey;

ALTER TABLE public.appointment_services
  ADD CONSTRAINT appointment_services_service_id_fkey
  FOREIGN KEY (service_id)
  REFERENCES public.services(id)
  ON DELETE CASCADE;

-- Corrige a baixa de pagamentos/sinais.
--
-- O trigger apply_appointment_payment usa:
--   ON CONFLICT (appointment_payment_id)
--
-- O índice original era UNIQUE parcial (WHERE appointment_payment_id IS NOT NULL).
-- PostgreSQL não consegue inferir esse índice para o ON CONFLICT acima e retorna:
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification".
--
-- Como UNIQUE já permite múltiplos NULLs no PostgreSQL, o predicado parcial é
-- desnecessário. Recriamos o índice como UNIQUE normal, tornando o ON CONFLICT
-- válido sem alterar a regra de negócio.

DROP INDEX IF EXISTS public.uq_financial_tx_payment;

CREATE UNIQUE INDEX uq_financial_tx_payment
  ON public.financial_transactions (appointment_payment_id);

-- Garante que o trigger de pagamentos esteja apontando para a função financeira
-- central já existente. Isso faz com que, ao aprovar/registrar qualquer valor:
--   1. o pagamento entre no caixa;
--   2. appointments.paid_cents seja recalculado;
--   3. payment_status vire deposit_paid enquanto houver saldo;
--   4. payment_status vire paid quando o total for quitado;
--   5. o saldo restante seja sempre total - pagamentos aprovados.
DROP TRIGGER IF EXISTS trg_apply_appointment_payment ON public.appointment_payments;
CREATE TRIGGER trg_apply_appointment_payment
  AFTER INSERT OR UPDATE OR DELETE ON public.appointment_payments
  FOR EACH ROW EXECUTE FUNCTION public.apply_appointment_payment();

-- Recalcula os agendamentos existentes para corrigir qualquer saldo/status que
-- tenha ficado desatualizado por tentativas anteriores de baixa.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT a.id
    FROM public.appointments a
    LEFT JOIN public.appointment_payments p ON p.appointment_id = a.id
    WHERE p.id IS NOT NULL
       OR COALESCE(a.paid_cents, 0) <> 0
       OR a.payment_status <> 'pending'
  LOOP
    PERFORM public.recalc_appointment_finance(r.id);
  END LOOP;
END $$;

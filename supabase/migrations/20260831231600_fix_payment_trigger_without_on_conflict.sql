-- Corrige definitivamente a baixa de sinal/pagamento sem depender de ON CONFLICT.
--
-- Em alguns bancos a migration que recria o índice pode ainda não ter sido aplicada,
-- então o trigger antigo continua falhando em:
--   ON CONFLICT (appointment_payment_id)
-- com a mensagem:
--   there is no unique or exclusion constraint matching the ON CONFLICT specification
--
-- Esta versão torna a função independente desse detalhe de índice: primeiro procura
-- a transação financeira vinculada ao pagamento; se existir, atualiza; se não existir,
-- insere. Assim funciona tanto com índice parcial quanto com índice único normal.

CREATE OR REPLACE FUNCTION public.apply_appointment_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  label text;
  appt_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.financial_transactions
    WHERE appointment_payment_id = OLD.id;

    INSERT INTO public.financial_audit_log (
      company_id, appointment_id, payment_id, action,
      description, amount_cents, actor_user_id
    ) VALUES (
      OLD.company_id, OLD.appointment_id, OLD.id,
      'payment_deleted', 'Pagamento removido', OLD.amount_cents, auth.uid()
    );

    PERFORM public.recalc_appointment_finance(OLD.appointment_id);
    RETURN OLD;
  END IF;

  label := CASE NEW.kind
    WHEN 'deposit' THEN 'Sinal (pagamento antecipado)'
    WHEN 'final' THEN 'Pagamento do atendimento'
    WHEN 'extra' THEN 'Acréscimo do atendimento'
    ELSE 'Estorno'
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_audit_log (
      company_id, appointment_id, payment_id, action,
      description, amount_cents, actor_user_id
    ) VALUES (
      NEW.company_id, NEW.appointment_id, NEW.id,
      CASE WHEN NEW.kind = 'deposit' THEN 'deposit_submitted' ELSE 'payment_created' END,
      label || ' registrado (' || NEW.status || ')',
      NEW.amount_cents, auth.uid()
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.financial_audit_log (
      company_id, appointment_id, payment_id, action,
      description, amount_cents, actor_user_id
    ) VALUES (
      NEW.company_id, NEW.appointment_id, NEW.id,
      'payment_' || NEW.status,
      label || ' ' || CASE NEW.status
        WHEN 'approved' THEN 'aprovado'
        WHEN 'rejected' THEN 'rejeitado'
        ELSE 'pendente'
      END,
      NEW.amount_cents, auth.uid()
    );
  END IF;

  IF NEW.status = 'approved' THEN
    IF EXISTS (
      SELECT 1
      FROM public.financial_transactions
      WHERE appointment_payment_id = NEW.id
    ) THEN
      UPDATE public.financial_transactions
      SET
        company_id = NEW.company_id,
        type = CASE WHEN NEW.kind = 'refund' THEN 'expense' ELSE 'income' END::transaction_type,
        category = CASE WHEN NEW.kind = 'refund' THEN 'Estornos' ELSE 'Serviços' END,
        description = label || ' · agendamento #' || substr(NEW.appointment_id::text, 1, 8),
        amount = NEW.amount_cents / 100.0,
        occurred_on = CURRENT_DATE,
        appointment_id = NEW.appointment_id,
        created_by = COALESCE(NEW.reviewed_by, NEW.created_by)
      WHERE appointment_payment_id = NEW.id;
    ELSE
      INSERT INTO public.financial_transactions (
        company_id, type, category, description, amount, occurred_on,
        appointment_id, payment_method_id, appointment_payment_id, created_by
      ) VALUES (
        NEW.company_id,
        CASE WHEN NEW.kind = 'refund' THEN 'expense' ELSE 'income' END::transaction_type,
        CASE WHEN NEW.kind = 'refund' THEN 'Estornos' ELSE 'Serviços' END,
        label || ' · agendamento #' || substr(NEW.appointment_id::text, 1, 8),
        NEW.amount_cents / 100.0,
        CURRENT_DATE,
        NEW.appointment_id,
        NULL,
        NEW.id,
        COALESCE(NEW.reviewed_by, NEW.created_by)
      );
    END IF;
  ELSE
    DELETE FROM public.financial_transactions
    WHERE appointment_payment_id = NEW.id;
  END IF;

  appt_id := NEW.appointment_id;
  PERFORM public.recalc_appointment_finance(appt_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_appointment_payment ON public.appointment_payments;

CREATE TRIGGER trg_apply_appointment_payment
AFTER INSERT OR UPDATE OR DELETE ON public.appointment_payments
FOR EACH ROW EXECUTE FUNCTION public.apply_appointment_payment();

-- Reprocessa pagamentos já aprovados para reconstruir o caixa/saldo quando necessário.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT appointment_id
    FROM public.appointment_payments
  LOOP
    PERFORM public.recalc_appointment_finance(r.appointment_id);
  END LOOP;
END;
$$;

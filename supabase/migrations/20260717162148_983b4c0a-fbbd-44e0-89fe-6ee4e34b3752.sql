
CREATE OR REPLACE FUNCTION public.finalize_appointment_marketing()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  prog record;
  final_cents integer;
  pts integer := 0;
  cb integer := 0;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') AND NEW.loyalty_credited_at IS NULL THEN
    final_cents := GREATEST(0, COALESCE(NEW.total_cents,0) - COALESCE(NEW.discount_cents,0));

    IF NEW.coupon_id IS NOT NULL THEN
      UPDATE public.coupons SET used_count = used_count + 1 WHERE id = NEW.coupon_id;
    END IF;

    SELECT * INTO prog FROM public.loyalty_programs
      WHERE company_id = NEW.company_id AND active = true LIMIT 1;

    IF FOUND AND NEW.customer_id IS NOT NULL AND final_cents > 0 THEN
      IF prog.points_per_brl IS NOT NULL AND prog.points_per_brl > 0 THEN
        pts := floor(final_cents / 100.0 * prog.points_per_brl);
      END IF;
      IF prog.cashback_percent IS NOT NULL AND prog.cashback_percent > 0 THEN
        cb := floor(final_cents * prog.cashback_percent / 100.0);
      END IF;

      IF pts > 0 THEN
        INSERT INTO public.loyalty_transactions (company_id, customer_id, type, points, amount_cents, notes)
        VALUES (NEW.company_id, NEW.customer_id, 'earn_points', pts, 0, 'Agendamento #'||substr(NEW.id::text,1,8));
      END IF;
      IF cb > 0 THEN
        INSERT INTO public.loyalty_transactions (company_id, customer_id, type, points, amount_cents, notes)
        VALUES (NEW.company_id, NEW.customer_id, 'earn_cashback', 0, cb, 'Cashback do agendamento #'||substr(NEW.id::text,1,8));
      END IF;

      IF pts > 0 OR cb > 0 THEN
        INSERT INTO public.notifications (company_id, kind, title, body, link, metadata)
        VALUES (NEW.company_id, 'loyalty_earned', 'Fidelidade creditada',
          'Cliente ganhou '||pts||' pts e '||to_char(cb/100.0,'FM999G990D00')||' de cashback',
          '/app/loyalty', jsonb_build_object('customer_id', NEW.customer_id));
      END IF;
    END IF;

    NEW.loyalty_points_earned := pts;
    NEW.cashback_earned_cents := cb;
    NEW.loyalty_credited_at := now();
  END IF;
  RETURN NEW;
END; $$;

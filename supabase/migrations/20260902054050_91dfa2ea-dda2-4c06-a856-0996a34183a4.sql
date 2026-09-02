CREATE TABLE IF NOT EXISTS public.resellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  commission_percent numeric(5,2) NOT NULL CHECK (commission_percent >= 0 AND commission_percent <= 100),
  payout_day smallint NOT NULL DEFAULT 10 CHECK (payout_day BETWEEN 1 AND 28),
  pix_key text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reseller_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE RESTRICT,
  commission_percent numeric(5,2) NOT NULL CHECK (commission_percent >= 0 AND commission_percent <= 100),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','earned','paid','cancelled')),
  first_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  first_payment_amount numeric,
  commission_amount numeric,
  earned_at timestamptz,
  scheduled_payout_date date,
  paid_at timestamptz,
  payout_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reseller_sales_reseller_status_idx ON public.reseller_sales(reseller_id,status,created_at DESC);
ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_sales ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.resellers, public.reseller_sales TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.resellers, public.reseller_sales TO authenticated;
GRANT ALL ON public.resellers, public.reseller_sales TO service_role;

CREATE POLICY "admin manages resellers" ON public.resellers FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "reseller reads own profile" ON public.resellers FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE POLICY "admin manages reseller sales" ON public.reseller_sales FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "reseller reads own sales" ON public.reseller_sales FOR SELECT TO authenticated USING (reseller_id IN (SELECT id FROM public.resellers WHERE user_id=auth.uid()));

CREATE OR REPLACE FUNCTION public.is_reseller() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.resellers WHERE user_id=auth.uid() AND active);
$$;
GRANT EXECUTE ON FUNCTION public.is_reseller() TO authenticated;

CREATE OR REPLACE FUNCTION public.link_reseller_company(_reseller_id uuid,_company_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE pct numeric;
BEGIN
  IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT commission_percent INTO pct FROM public.resellers WHERE id=_reseller_id AND active;
  IF pct IS NULL THEN RAISE EXCEPTION 'Revendedor inválido ou inativo'; END IF;
  INSERT INTO public.reseller_sales(reseller_id,company_id,commission_percent) VALUES(_reseller_id,_company_id,pct);
  RETURN jsonb_build_object('ok',true);
END; $$;
GRANT EXECUTE ON FUNCTION public.link_reseller_company(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.release_reseller_commission() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sale public.reseller_sales%ROWTYPE; pay_day int; target_month date; payout date;
BEGIN
  SELECT * INTO sale FROM public.reseller_sales WHERE company_id=NEW.company_id AND status='pending' FOR UPDATE;
  IF sale.id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM public.payments p WHERE p.company_id=NEW.company_id AND p.id<>NEW.id) THEN RETURN NEW; END IF;
  SELECT payout_day INTO pay_day FROM public.resellers WHERE id=sale.reseller_id;
  target_month := date_trunc('month', current_date)::date;
  payout := (target_month + (pay_day-1))::date;
  IF payout <= current_date THEN payout := (target_month + interval '1 month' + (pay_day-1) * interval '1 day')::date; END IF;
  UPDATE public.reseller_sales SET status='earned',first_payment_id=NEW.id,first_payment_amount=NEW.amount,
    commission_amount=round((NEW.amount * commission_percent / 100)::numeric,2),earned_at=now(),scheduled_payout_date=payout,updated_at=now()
  WHERE id=sale.id;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_release_reseller_commission ON public.payments;
CREATE TRIGGER trg_release_reseller_commission AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.release_reseller_commission();

CREATE OR REPLACE FUNCTION public.mark_reseller_commission_paid(_sale_id uuid,_reference text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 UPDATE public.reseller_sales SET status='paid',paid_at=now(),payout_reference=nullif(trim(_reference),''),updated_at=now() WHERE id=_sale_id AND status='earned';
 IF NOT FOUND THEN RAISE EXCEPTION 'Comissão indisponível para repasse'; END IF;
 RETURN jsonb_build_object('ok',true);
END; $$;
GRANT EXECUTE ON FUNCTION public.mark_reseller_commission_paid(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_customer_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  f text;
  oldv text;
  newv text;
BEGIN
  FOREACH f IN ARRAY ARRAY['name','phone','whatsapp','email','birthdate','notes'] LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', f, f)
      INTO oldv, newv USING OLD, NEW;
    IF oldv IS DISTINCT FROM newv THEN
      INSERT INTO public.customer_profile_history
        (company_id, customer_id, entity, action, field, old_value, new_value, actor_user_id)
      VALUES (NEW.company_id, NEW.id, 'customer', 'updated', f, oldv, newv, auth.uid());
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER audit_customer_fields_trg
  AFTER UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.audit_customer_fields();

CREATE OR REPLACE FUNCTION public.audit_customer_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.customer_profile_history
    (company_id, customer_id, entity, action, field, new_value, actor_user_id)
  VALUES (NEW.company_id, NEW.id, 'customer', 'created', 'name', NEW.name, auth.uid());
  RETURN NEW;
END; $$;

CREATE TRIGGER audit_customer_created_trg
  AFTER INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.audit_customer_created();

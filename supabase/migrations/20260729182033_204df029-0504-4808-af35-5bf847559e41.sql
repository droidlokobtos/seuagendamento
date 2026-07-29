
-- ============ PERFIL INTELIGENTE DO CLIENTE ============

CREATE TABLE public.customer_profiles (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  preferred_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  communication_pref text NOT NULL DEFAULT 'whatsapp',
  restrictions text[] NOT NULL DEFAULT '{}',
  general_notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_profiles TO authenticated;
GRANT ALL ON public.customer_profiles TO service_role;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage customer profiles" ON public.customer_profiles
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER touch_customer_profiles BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'preference',
  content text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_notes_customer_idx ON public.customer_notes(customer_id, pinned DESC, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_notes TO authenticated;
GRANT ALL ON public.customer_notes TO service_role;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage customer notes" ON public.customer_notes
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER touch_customer_notes BEFORE UPDATE ON public.customer_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.customer_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'other',
  title text,
  date date NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_dates_customer_idx ON public.customer_dates(customer_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_dates TO authenticated;
GRANT ALL ON public.customer_dates TO service_role;
ALTER TABLE public.customer_dates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage customer dates" ON public.customer_dates
  FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));
CREATE TRIGGER touch_customer_dates BEFORE UPDATE ON public.customer_dates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.customer_profile_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  entity text NOT NULL,
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_profile_history_idx ON public.customer_profile_history(customer_id, created_at DESC);
GRANT SELECT ON public.customer_profile_history TO authenticated;
GRANT ALL ON public.customer_profile_history TO service_role;
ALTER TABLE public.customer_profile_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read customer profile history" ON public.customer_profile_history
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

-- ============ AUDITORIA AUTOMÁTICA ============

CREATE OR REPLACE FUNCTION public.audit_customer_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cid uuid;
  comp uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    cid := OLD.customer_id; comp := OLD.company_id;
  ELSE
    cid := NEW.customer_id; comp := NEW.company_id;
  END IF;

  IF TG_TABLE_NAME = 'customer_profiles' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.customer_profile_history (company_id, customer_id, entity, action, actor_user_id)
      VALUES (comp, cid, 'profile', 'created', auth.uid());
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.preferred_staff_id IS DISTINCT FROM OLD.preferred_staff_id THEN
        INSERT INTO public.customer_profile_history (company_id, customer_id, entity, action, field, old_value, new_value, actor_user_id)
        VALUES (comp, cid, 'profile', 'updated', 'preferred_staff_id', OLD.preferred_staff_id::text, NEW.preferred_staff_id::text, auth.uid());
      END IF;
      IF NEW.communication_pref IS DISTINCT FROM OLD.communication_pref THEN
        INSERT INTO public.customer_profile_history (company_id, customer_id, entity, action, field, old_value, new_value, actor_user_id)
        VALUES (comp, cid, 'profile', 'updated', 'communication_pref', OLD.communication_pref, NEW.communication_pref, auth.uid());
      END IF;
      IF NEW.restrictions IS DISTINCT FROM OLD.restrictions THEN
        INSERT INTO public.customer_profile_history (company_id, customer_id, entity, action, field, old_value, new_value, actor_user_id)
        VALUES (comp, cid, 'profile', 'updated', 'restrictions', array_to_string(OLD.restrictions, ', '), array_to_string(NEW.restrictions, ', '), auth.uid());
      END IF;
      IF NEW.general_notes IS DISTINCT FROM OLD.general_notes THEN
        INSERT INTO public.customer_profile_history (company_id, customer_id, entity, action, field, old_value, new_value, actor_user_id)
        VALUES (comp, cid, 'profile', 'updated', 'general_notes', OLD.general_notes, NEW.general_notes, auth.uid());
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'customer_notes' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.customer_profile_history (company_id, customer_id, entity, action, field, new_value, actor_user_id)
      VALUES (comp, cid, 'note', 'created', NEW.kind, NEW.content, auth.uid());
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.content IS DISTINCT FROM OLD.content THEN
        INSERT INTO public.customer_profile_history (company_id, customer_id, entity, action, field, old_value, new_value, actor_user_id)
        VALUES (comp, cid, 'note', 'updated', 'content', OLD.content, NEW.content, auth.uid());
      END IF;
      IF NEW.pinned IS DISTINCT FROM OLD.pinned THEN
        INSERT INTO public.customer_profile_history (company_id, customer_id, entity, action, field, old_value, new_value, actor_user_id)
        VALUES (comp, cid, 'note', 'updated', 'pinned', OLD.pinned::text, NEW.pinned::text, auth.uid());
      END IF;
    ELSE
      INSERT INTO public.customer_profile_history (company_id, customer_id, entity, action, field, old_value, actor_user_id)
      VALUES (comp, cid, 'note', 'deleted', OLD.kind, OLD.content, auth.uid());
    END IF;
  ELSIF TG_TABLE_NAME = 'customer_dates' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.customer_profile_history (company_id, customer_id, entity, action, field, new_value, actor_user_id)
      VALUES (comp, cid, 'date', 'created', NEW.kind, COALESCE(NEW.title,'') || ' ' || NEW.date::text, auth.uid());
    ELSIF TG_OP = 'UPDATE' THEN
      INSERT INTO public.customer_profile_history (company_id, customer_id, entity, action, field, old_value, new_value, actor_user_id)
      VALUES (comp, cid, 'date', 'updated', NEW.kind, COALESCE(OLD.title,'') || ' ' || OLD.date::text, COALESCE(NEW.title,'') || ' ' || NEW.date::text, auth.uid());
    ELSE
      INSERT INTO public.customer_profile_history (company_id, customer_id, entity, action, field, old_value, actor_user_id)
      VALUES (comp, cid, 'date', 'deleted', OLD.kind, COALESCE(OLD.title,'') || ' ' || OLD.date::text, auth.uid());
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER audit_customer_profiles
  AFTER INSERT OR UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_customer_profile();

CREATE TRIGGER audit_customer_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_customer_profile();

CREATE TRIGGER audit_customer_dates
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_dates
  FOR EACH ROW EXECUTE FUNCTION public.audit_customer_profile();

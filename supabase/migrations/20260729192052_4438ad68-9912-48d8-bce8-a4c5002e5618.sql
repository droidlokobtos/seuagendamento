-- token público gerado automaticamente
ALTER TABLE public.review_settings
  ALTER COLUMN public_token SET DEFAULT upper(encode(gen_random_bytes(5), 'hex'));

CREATE OR REPLACE FUNCTION public.ensure_review_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.review_settings (company_id)
  VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.ensure_review_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_review_settings() TO service_role;

DROP TRIGGER IF EXISTS trg_ensure_review_settings ON public.companies;
CREATE TRIGGER trg_ensure_review_settings
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.ensure_review_settings();

-- backfill das empresas existentes
INSERT INTO public.review_settings (company_id)
SELECT c.id FROM public.companies c
ON CONFLICT (company_id) DO NOTHING;

UPDATE public.review_settings
SET public_token = upper(encode(gen_random_bytes(5), 'hex'))
WHERE public_token IS NULL OR public_token = '';
ALTER TABLE public.review_settings
  ADD COLUMN IF NOT EXISTS public_token text,
  ADD COLUMN IF NOT EXISTS public_link_enabled boolean NOT NULL DEFAULT true;

UPDATE public.review_settings
  SET public_token = upper(encode(gen_random_bytes(5), 'hex'))
  WHERE public_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS review_settings_public_token_key
  ON public.review_settings (public_token);

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS customer_name text;
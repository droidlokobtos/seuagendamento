
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS photo_url text;

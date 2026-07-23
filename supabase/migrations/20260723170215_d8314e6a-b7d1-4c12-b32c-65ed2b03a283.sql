ALTER TABLE public.services ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS photo_position text NOT NULL DEFAULT 'center center';
CREATE INDEX IF NOT EXISTS services_company_sort_idx ON public.services (company_id, sort_order, name);
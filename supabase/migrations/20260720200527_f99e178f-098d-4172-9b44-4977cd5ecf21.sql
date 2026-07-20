INSERT INTO public.niches (name)
SELECT 'Cuidados com Pessoas'
WHERE NOT EXISTS (SELECT 1 FROM public.niches WHERE name = 'Cuidados com Pessoas');

WITH n AS (SELECT id FROM public.niches WHERE name = 'Cuidados com Pessoas' LIMIT 1)
INSERT INTO public.sub_niches (niche_id, name)
SELECT n.id, s.name
FROM n, (VALUES
  ('Cabelos'),
  ('Unhas'),
  ('Sobrancelhas e Cílios'),
  ('Maquiagem'),
  ('Estética Facial'),
  ('Estética Corporal'),
  ('Massagens e Terapias'),
  ('Bem-estar'),
  ('Salões, Barbearias e Studios')
) AS s(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.sub_niches sn WHERE sn.niche_id = n.id AND sn.name = s.name
);

CREATE POLICY "authenticated read company-assets" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'company-assets');
CREATE POLICY "authenticated insert company-assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'company-assets');
CREATE POLICY "authenticated update company-assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'company-assets');
CREATE POLICY "authenticated delete company-assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'company-assets');

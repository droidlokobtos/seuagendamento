-- Impede que um usuário autenticado acesse arquivos de outra empresa.
-- Todos os objetos do bucket seguem o padrão: <company_id>/<pasta>/<arquivo>.

drop policy if exists "authenticated read company-assets" on storage.objects;
drop policy if exists "authenticated insert company-assets" on storage.objects;
drop policy if exists "authenticated update company-assets" on storage.objects;
drop policy if exists "authenticated delete company-assets" on storage.objects;

create policy "company members read own assets"
on storage.objects for select to authenticated
using (
  bucket_id = 'company-assets'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.company_users cu
      where cu.user_id = auth.uid()
        and cu.active = true
        and cu.company_id::text = (storage.foldername(name))[1]
    )
  )
);

create policy "company members insert own assets"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-assets'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.company_users cu
      where cu.user_id = auth.uid()
        and cu.active = true
        and cu.company_id::text = (storage.foldername(name))[1]
    )
  )
);

create policy "company members update own assets"
on storage.objects for update to authenticated
using (
  bucket_id = 'company-assets'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.company_users cu
      where cu.user_id = auth.uid()
        and cu.active = true
        and cu.company_id::text = (storage.foldername(name))[1]
    )
  )
)
with check (
  bucket_id = 'company-assets'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.company_users cu
      where cu.user_id = auth.uid()
        and cu.active = true
        and cu.company_id::text = (storage.foldername(name))[1]
    )
  )
);

create policy "company members delete own assets"
on storage.objects for delete to authenticated
using (
  bucket_id = 'company-assets'
  and (
    public.is_super_admin()
    or exists (
      select 1
      from public.company_users cu
      where cu.user_id = auth.uid()
        and cu.active = true
        and cu.company_id::text = (storage.foldername(name))[1]
    )
  )
);

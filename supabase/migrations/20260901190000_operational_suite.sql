-- Unified operational foundation: cash sessions, expenses and immutable audit trail.
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  opened_by uuid not null, opened_at timestamptz not null default now(), opening_cents integer not null default 0 check (opening_cents >= 0),
  closed_by uuid, closed_at timestamptz, expected_cents integer, counted_cents integer, difference_cents integer,
  notes text, status text not null default 'open' check (status in ('open','closed'))
);
create unique index if not exists cash_sessions_one_open on public.cash_sessions(company_id) where status='open';
create index if not exists cash_sessions_company_date on public.cash_sessions(company_id, opened_at desc);

create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  category text not null default 'Outros', description text not null, amount_cents integer not null check (amount_cents > 0),
  due_date date, paid_at timestamptz, payment_method text, status text not null default 'pending' check(status in ('pending','paid','cancelled')),
  created_by uuid, created_at timestamptz not null default now()
);
create index if not exists business_expenses_company_date on public.business_expenses(company_id, due_date desc);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key, company_id uuid references public.companies(id) on delete cascade,
  actor_id uuid, action text not null, entity_type text not null, entity_id text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_company_created on public.audit_events(company_id, created_at desc);

alter table public.cash_sessions enable row level security;
alter table public.business_expenses enable row level security;
alter table public.audit_events enable row level security;
drop policy if exists cash_sessions_company on public.cash_sessions;
create policy cash_sessions_company on public.cash_sessions for all to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists business_expenses_company on public.business_expenses;
create policy business_expenses_company on public.business_expenses for all to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
drop policy if exists audit_events_company on public.audit_events;
create policy audit_events_company on public.audit_events for select to authenticated using (public.is_company_member(company_id));

create or replace function public.audit_company_change() returns trigger language plpgsql security definer set search_path=public as $$
declare cid uuid; eid text; begin
  cid := coalesce((to_jsonb(new)->>'company_id')::uuid,(to_jsonb(old)->>'company_id')::uuid);
  eid := coalesce(to_jsonb(new)->>'id',to_jsonb(old)->>'id');
  insert into public.audit_events(company_id,actor_id,action,entity_type,entity_id,metadata)
  values(cid,auth.uid(),lower(tg_op),tg_table_name,eid,jsonb_build_object('old',case when tg_op='INSERT' then null else to_jsonb(old) end,'new',case when tg_op='DELETE' then null else to_jsonb(new) end));
  return coalesce(new,old); end $$;
do $$ declare t text; begin foreach t in array array['appointments','appointment_payments','sales','inventory_movements','business_expenses','cash_sessions'] loop
  execute format('drop trigger if exists trg_audit_%I on public.%I',t,t);
  execute format('create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.audit_company_change()',t,t);
end loop; end $$;

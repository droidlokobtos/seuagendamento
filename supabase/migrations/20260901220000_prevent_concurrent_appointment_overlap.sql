-- A checagem na aplicação não é suficiente contra duas reservas simultâneas.
-- O bloqueio consultivo serializa gravações do mesmo profissional e o trigger
-- mantém a regra no banco para qualquer cliente (portal, painel ou service role).

create or replace function public.prevent_appointment_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.staff_id is null or new.status in (
    'cancelled',
    'cancelled_by_customer',
    'cancelled_by_company',
    'completed',
    'no_show'
  ) then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.company_id::text || ':' || new.staff_id::text, 0)
  );

  if exists (
    select 1
    from public.appointments existing
    where existing.company_id = new.company_id
      and existing.staff_id = new.staff_id
      and existing.id <> new.id
      and existing.status not in (
        'cancelled',
        'cancelled_by_customer',
        'cancelled_by_company',
        'completed',
        'no_show'
      )
      and existing.starts_at < new.ends_at
      and existing.ends_at > new.starts_at
  ) then
    raise exception using
      errcode = '23P01',
      message = 'Horário indisponível: já existe outro agendamento para este profissional.';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_appointment_overlap() from public, anon, authenticated;
grant execute on function public.prevent_appointment_overlap() to service_role;

drop trigger if exists trg_prevent_appointment_overlap on public.appointments;
create trigger trg_prevent_appointment_overlap
before insert or update of company_id, staff_id, starts_at, ends_at, status
on public.appointments
for each row execute function public.prevent_appointment_overlap();

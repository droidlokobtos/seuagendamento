alter table public.business_expenses
  add column if not exists financial_transaction_id uuid references public.financial_transactions(id) on delete set null;

create unique index if not exists business_expenses_financial_transaction_uidx
  on public.business_expenses(financial_transaction_id)
  where financial_transaction_id is not null;

create or replace function public.mark_business_expense_paid(
  p_expense_id uuid,
  p_payment_method_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense public.business_expenses%rowtype;
  v_method public.payment_methods%rowtype;
  v_tx_id uuid;
begin
  select * into v_expense
  from public.business_expenses
  where id = p_expense_id
  for update;

  if not found then
    raise exception 'Despesa não encontrada.';
  end if;

  if not public.is_company_member(v_expense.company_id) then
    raise exception 'Sem permissão para esta empresa.';
  end if;

  if v_expense.status = 'cancelled' then
    raise exception 'Despesa cancelada não pode ser paga.';
  end if;

  if v_expense.status = 'paid' then
    if v_expense.financial_transaction_id is not null then
      return v_expense.financial_transaction_id;
    end if;
    raise exception 'Despesa já está paga e não possui vínculo financeiro. Revise este lançamento antes de continuar.';
  end if;

  if p_payment_method_id is null then
    raise exception 'Informe a forma de pagamento.';
  end if;

  select * into v_method
  from public.payment_methods
  where id = p_payment_method_id
    and company_id = v_expense.company_id
    and enabled = true;

  if not found then
    raise exception 'Forma de pagamento inválida ou desativada.';
  end if;

  insert into public.financial_transactions (
    company_id,
    type,
    category,
    description,
    amount,
    occurred_on,
    payment_method_id,
    created_by
  ) values (
    v_expense.company_id,
    'expense',
    v_expense.category,
    v_expense.description,
    round(v_expense.amount_cents::numeric / 100, 2),
    (timezone('America/Sao_Paulo', now()))::date,
    v_method.id,
    auth.uid()
  )
  returning id into v_tx_id;

  update public.business_expenses
  set status = 'paid',
      paid_at = now(),
      payment_method = v_method.method::text,
      financial_transaction_id = v_tx_id
  where id = v_expense.id;

  return v_tx_id;
end;
$$;

grant execute on function public.mark_business_expense_paid(uuid, uuid) to authenticated;

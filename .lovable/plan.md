# Fase 2 — Painel da Empresa

Objetivo: dar ao `company_admin` (e `staff`) o painel operacional do dia a dia, isolado por `company_id` via RLS, sobre a base já pronta da Fase 1.

## O que entra nesta fase

1. **Layout da Empresa** (`/app/*`)
   - Sidebar recolhível + topbar com nome/logo/cores da empresa ativa (white label real).
   - Se o usuário pertence a mais de uma empresa, seletor no topo.
   - Menu: Dashboard, Agenda, Clientes, Funcionários, Serviços, Configurações.

2. **Dashboard da empresa** (`/app`)
   - Cards: agendamentos de hoje, próximos 7 dias, clientes ativos, faturamento estimado do mês (soma de serviços concluídos).
   - Lista de próximos agendamentos do dia.

3. **Serviços** (`/app/services`)
   - CRUD: nome, duração (min), preço, categoria, cor, ativo.
   - Sugestão inicial: importar do nicho da empresa (`niches.suggested_services`).

4. **Funcionários** (`/app/staff`)
   - CRUD: nome, telefone, cargo, cor, comissão %, foto, ativo.
   - Vínculo opcional a um `auth.user` (para dar acesso ao painel como `staff`).
   - Seleção de serviços que o funcionário executa.
   - Horário de trabalho por dia da semana.

5. **Clientes** (`/app/customers`)
   - CRUD: nome, telefone, email, aniversário, observações, tags.
   - Busca e paginação.
   - Ficha com histórico de agendamentos.

6. **Agenda** (`/app/agenda`) — coração da fase
   - Visões: Dia (grade por funcionário), Semana, Mês.
   - Criar/editar/mover agendamento (cliente + serviço(s) + funcionário + horário).
   - Status coloridos: agendado, confirmado, em atendimento, concluído, cancelado, faltou.
   - Botão "Enviar confirmação" gera texto WhatsApp (`wa.me`) com dados do agendamento.
   - Respeita horário de funcionamento e do funcionário; bloqueia conflito.

7. **Configurações da empresa** (`/app/settings`)
   - Dados cadastrais e visuais (logo, cores) editáveis pelo próprio dono.
   - Horários de funcionamento por dia da semana + intervalos/folgas.
   - Slug público (base para a página de agendamento da Fase 4).
   - Formas de pagamento aceitas (dinheiro, pix, cartão, etc.).

## Detalhes técnicos

**Novas tabelas (todas com RLS por `company_id` + GRANTs):**

- `services` — company_id, name, duration_min, price_cents, category, color, active
- `staff` — company_id, user_id (null), name, phone, role_title, color, commission_pct, photo_url, active
- `staff_services` — staff_id, service_id
- `staff_schedules` — staff_id, weekday (0-6), start_time, end_time
- `customers` — company_id, name, phone, email, birthdate, notes, tags text[]
- `appointments` — company_id, customer_id, staff_id, starts_at, ends_at, status, total_cents, notes
- `appointment_services` — appointment_id, service_id, price_cents, duration_min
- `company_hours` — company_id, weekday, start_time, end_time, closed
- `payment_methods` — company_id, method, enabled

**Segurança:**
- Helper `is_company_member(_company uuid)` (`security definer`) para RLS sem recursão.
- Políticas: membros da empresa leem/escrevem dados da própria empresa; `super_admin` vê tudo.
- Todos os `INSERT`/`UPDATE` validam `company_id` via `WITH CHECK`.

**Frontend:**
- React Query em todos os módulos (list/detail/mutation, invalidations por chave).
- Componente `AppLayout` novo em `src/components/app/AppLayout.tsx` (espelho do `AdminLayout`, com cores da empresa).
- Contexto `CompanyContext` para empresa ativa (persistida em `localStorage`).
- Agenda usa layout custom (sem dependência pesada nova) — grade CSS por hora × funcionário.

## Fora desta fase
- Financeiro/estoque/relatórios → Fase 3.
- Página pública `/agendar/:slug` → Fase 4.
- Marketing/fidelidade → Fase 5.

---

Confirma que sigo com **tudo isso** de uma vez? É uma fase densa (7 módulos + agenda). Se preferir, posso quebrar em duas entregas:
- **2A**: Layout + Serviços + Funcionários + Clientes + Configurações.
- **2B**: Agenda completa + Dashboard da empresa.

Me diz: **tudo junto** ou **2A primeiro**?

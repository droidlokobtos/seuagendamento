
# Plataforma SaaS White Label — Agendamento Beleza

Stack: React + TanStack Start + Tailwind + shadcn/ui + Lovable Cloud (Postgres, Auth, Storage). PWA responsivo (desktop, tablet, mobile) — funciona instalado no Android/iOS como app.

---

## Fase 1 — Fundação + Admin Master (esta entrega)

**Objetivo:** ter a operação central do dono da plataforma funcionando, com dados reais isolados por empresa, antes de construir os módulos operacionais.

### O que entra
1. **Lovable Cloud + Auth** (email/senha) e sistema de papéis seguro (`super_admin`, `company_admin`, `staff`, `customer`) em tabela `user_roles` separada.
2. **Multi-tenant por `company_id`** com RLS em todas as tabelas: cada empresa só enxerga seus dados; super_admin enxerga tudo.
3. **Nichos**: CRUD (nome, cor, logo padrão, banner, serviços sugeridos).
4. **Empresas**: CRUD completo (dados, responsável, CPF/CNPJ, contatos, endereço, nicho, logo, cores, tema), ativar / suspender / reativar, criação do usuário admin da empresa junto.
5. **Assinatura manual PIX**:
   - Configuração global da chave PIX / banco / recebedor.
   - Por empresa: valor (R$ 49,90 default), vencimento, último pagamento, próximo vencimento.
   - Status automático: 🟢 Ativa · 🟡 Próximo vencimento (7 dias) · 🟠 Em atraso · 🔴 Suspensa.
   - Gerador de mensagem de cobrança (copiar + botão "Compartilhar via WhatsApp" usando `wa.me`).
   - Registro manual de pagamento recebido.
6. **Dashboard Admin Master**: nº de empresas por status, MRR estimado, próximos vencimentos, atrasadas, novas do mês.
7. **Login white label**: a tela da empresa já usa logo e cores dela.

### Fora desta fase (vem depois)
Agenda, clientes, funcionários, serviços, financeiro operacional, estoque, relatórios, marketing, app do cliente final, página pública de agendamento.

---

## Fase 2 — Painel da Empresa (operação diária)
Dashboard da empresa, **Agenda** (dia/semana/mês, status coloridos), **Clientes**, **Funcionários** (com agenda individual e comissão), **Serviços**, **Configurações** (horários, dias, intervalos, formas de pagamento). Gerador de mensagem WhatsApp de novo agendamento.

## Fase 3 — Financeiro, Estoque e Relatórios
Entradas/saídas/despesas/lucro, fluxo de caixa, fechamento diário. Estoque com fornecedores e mínimo. Relatórios exportáveis (PDF/Excel).

## Fase 4 — Página pública de agendamento (cliente final)
Rota pública `/agendar/:slug-da-empresa` totalmente white label: cliente escolhe serviço → profissional → horário → confirma. Cadastro/login do cliente, histórico, cancelamento, avaliação. Instalável como PWA.

## Fase 5 — Marketing
Promoções, cupons, aniversariantes, fidelidade, cashback.

---

## Detalhes técnicos (Fase 1)

**Tabelas principais (schema `public`, todas com RLS + GRANTs):**
- `niches` (id, name, primary_color, logo_url, banner_url, suggested_services jsonb)
- `companies` (id, niche_id, name, legal_name, doc, phone, whatsapp, email, address, logo_url, primary_color, secondary_color, theme, slug, status, monthly_fee, due_day, last_payment_at, next_due_at, created_at)
- `company_users` (user_id, company_id, role) — vínculo do usuário à empresa
- `user_roles` (user_id, role app_role) — papéis globais
- `payments` (id, company_id, amount, paid_at, note) — histórico manual
- `platform_settings` (singleton: pix_key, pix_bank, pix_holder)

**Funções de segurança:** `has_role(user_id, role)` e `current_company_id()` como `security definer` para evitar recursão em RLS.

**Rotas:**
- `/` — landing simples com CTA de login
- `/auth` — login (email/senha)
- `/_authenticated/admin/*` — Admin Master (dashboard, empresas, nichos, assinaturas, configurações PIX)
- `/_authenticated/app/*` — placeholder do painel da empresa (será preenchido na Fase 2)

**Design:** tema elegante e moderno, dark/light, tipografia sofisticada, sidebar recolhível, animações sutis. Definirei uma paleta neutra premium (não roxo/índigo padrão) — se quiser cor específica, me diga; senão eu escolho.

---

Confirma que começo pela **Fase 1** com esse recorte? Se sim, sigo direto para implementação.

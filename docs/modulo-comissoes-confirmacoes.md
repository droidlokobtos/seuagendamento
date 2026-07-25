# Módulo de Comissões e Confirmação Automática

## 1. Comissões

### Onde fica
`Financeiro → Comissões` (`/app/commissions`).

### Regras de comissão
Cadastradas por serviço em `Serviços → editar → Comissão`:

| Campo | Descrição |
| --- | --- |
| `has_commission` | Ativa a regra específica do serviço |
| `commission_type` | `fixed` (R$) ou `percent` (%) |
| `commission_value` | Valor fixo em reais ou percentual |

Quando o serviço **não** possui regra própria, o sistema usa o percentual do
funcionário (`staff.commission_pct`).

### Cálculo automático
Trigger `trg_generate_commissions` em `appointments` (AFTER UPDATE OF status).
Ao mudar para `completed`:

1. identifica o funcionário responsável e os serviços do agendamento;
2. localiza a regra (serviço → funcionário);
3. calcula o valor (`fixed` → valor × 100; `percent` → preço × % );
4. grava um registro em `commissions` (status `pending`);
5. lança uma **despesa** em `financial_transactions` (categoria "Comissões");
6. cria notificação `commission_created` para os administradores.

Índice único `(appointment_id, service_id, staff_id)` evita duplicidade.

### Permissões
- **Administrador da empresa / Admin Master**: criar, editar, excluir, marcar
  como pago, ver todos, exportar (PDF/Excel/CSV) e imprimir.
- **Funcionário**: vê somente as próprias comissões (policy `commissions own read`
  via `staff.user_id = auth.uid()`), com totais recebido/pendente e histórico.

## 2. Confirmação automática

### Fluxo
1. `pg_cron` chama `POST /api/public/hooks/confirmations` a cada 10 minutos.
2. Seleciona agendamentos `scheduled` dentro da janela de antecedência
   (`messaging_settings.reminder_hours`, padrão 24h) sem confirmação.
3. Gera token único (`randomToken`, 12 caracteres), monta a mensagem a partir do
   template e registra em `appointment_confirmations`.
4. Cria notificação com link/mensagem prontos e muda o agendamento para
   `reminder_sent`.
5. O cliente acessa `/confirmar/<token>` e confirma ou cancela.

### Token
Único, não reutilizável (`status` passa a `confirmed`/`cancelled`) e expira
automaticamente no horário do agendamento (`expires_at`).

### Ao responder
- **Confirmar** → agendamento `confirmed`; grava data/hora, IP e dispositivo.
- **Cancelar** → agendamento `cancelled_by_customer` com motivo opcional; o
  horário volta a ficar livre na agenda.

Ambos registram `messaging_logs` e notificação em tempo real para os
administradores.

### Reenvio manual
Em `Confirmações` (`/app/confirmations`) → "Reenviar". Bloqueado por 30 minutos
(`RESEND_COOLDOWN_MIN`) após o último envio.

### Integrações futuras
`src/lib/messaging.ts` centraliza canais, provedores e template.
`messaging_settings` guarda credenciais por empresa (WhatsApp Cloud API,
Evolution API, Z-API, Twilio, Resend/SendGrid/SMTP). Para ativar um provedor,
implemente o envio no hook `confirmations.ts` lendo `messaging_settings` — a
interface de configuração já existe em `Confirmações → Integrações`.

## 3. Status de agendamento
Centralizados em `src/lib/appointment-status.ts` (com cor própria):
`scheduled`, `reminder_sent`, `confirmed`, `in_progress`, `completed`,
`cancelled`, `cancelled_by_customer`, `cancelled_by_company`, `no_show`.

## 4. Tabelas criadas
`commissions`, `appointment_confirmations`, `messaging_settings`,
`messaging_logs` — todas com RLS multiempresa e `updated_at` automático.
Nenhuma tabela ou dado existente foi alterado.

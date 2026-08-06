# Atualização geral do BeautySaaS

Plano único de implementação cobrindo os 12 pontos solicitados. Abaixo, o que já foi confirmado no sistema, o que será construído e como será validado.

## Diagnóstico confirmado: erro ao "Finalizar Serviço"

Ao marcar o atendimento como concluído, uma cadeia de gatilhos do banco é disparada (comissões, financeiro, presença, planos, insumos, avaliação). Consultando o banco, três desses gatilhos gravam registros usando uma regra de "não duplicar" que aponta para combinações de campos que **não possuem índice único** correspondente:

- comissões: combinação atendimento + serviço + profissional
- eventos de presença: combinação atendimento + tipo de evento
- lançamentos financeiros: pagamento do atendimento

Nesses casos o Postgres aborta a transação inteira, então a finalização falha por completo. Essa é a causa raiz do erro — será corrigida criando os índices únicos que faltam (após limpeza de eventuais duplicatas existentes) e revisando cada gatilho.

## 1. Finalização de serviços (crítico)

- Criar os índices únicos ausentes e limpar duplicatas antes.
- Revisar todos os gatilhos da conclusão para serem idempotentes e tolerantes a falha: erros em etapas acessórias (notificação, avaliação, estoque) não podem impedir a conclusão do atendimento.
- Centralizar a finalização em uma função de servidor transacional que grava status + data/hora de conclusão e dispara, em ordem: agenda, histórico do cliente, comissão, caixa, financeiro, relatórios e notificações.
- Mensagens de erro claras na interface quando algo acessório falhar, sem reverter a conclusão.

## 2. Adicionar serviços durante o atendimento

- Botão "+ Adicionar Serviço" visível quando o atendimento está Em andamento.
- Diálogo com seleção de serviço, profissional responsável e observação.
- Ao confirmar: recalcula valor total, duração e horário final, recalcula comissões, atualiza caixa/financeiro/histórico e relatórios.
- Se o novo tempo estender o atendimento, verificar conflito de agenda e avisar antes de gravar; opção de ajustar ou trocar profissional.

## 3. Gestão de usuários

- Cadastro direto pelo Administrador (nome, e-mail, senha, cargo, permissões), sem convite por e-mail, com acesso imediato.
- Login identifica automaticamente a empresa vinculada ao e-mail; se houver mais de um vínculo, seleção da empresa.

## 4. Controle de permissões (frente e servidor)

- Mapa de permissões único e completo (Dashboard, Agenda, Agendamentos, Clientes, Cadastro de clientes, Histórico, Financeiro, Caixa, Serviços, Produtos, Estoque, Relatórios, Comissões, Configurações, Usuários, Edição, Exclusão, Ver contato do cliente, Desempenho).
- Menu, rotas e dashboards montados a partir das permissões, com negação por padrão.
- Toda função de servidor e regra de acesso ao banco valida a permissão correspondente — bloquear acesso direto por URL ou chamada de API.
- Auditoria de acessos negados.

## 5. Dashboards por perfil

- Administrador: painel completo.
- Recepcionista: agenda, agendamentos, clientes, check-in/check-out, confirmações, cadastro de clientes, caixa (se autorizado), notificações.
- Profissional: minha agenda, próximos atendimentos, clientes do dia, histórico, comissões, desempenho — sem financeiro, caixa, usuários, configurações, estoque, produtos, auditoria ou dados de outros profissionais.
- Telefone, WhatsApp e e-mail do cliente mascarados por padrão, liberados apenas com permissão específica (mascaramento também no servidor).

## 6. Personalização da página pública

- Editor com logo, banner, imagem de fundo, galeria, cores, fontes, botões, cards, slogan, mensagem inicial, redes sociais, WhatsApp e horário de funcionamento.
- Pré-visualização alternável Desktop/Mobile.
- Link exclusivo por empresa mantido e destacado no editor.

## 7. Cadastro de empresa

- Telefone/WhatsApp do proprietário obrigatório, com máscara brasileira e validação de celular (DDD + 9 dígitos), na interface e no banco.

## 8. Sistema de planos

- Um plano ativo por empresa, com catálogo: Básico R$ 49,90/mês; Business R$ 69,90/mês ou 6 meses R$ 398,43 (5% off); Pro R$ 109,90/mês ou 12 meses R$ 1.252,86 (5% off).
- Matriz de recursos por plano e limite de usuários (Básico: 3; demais: ilimitado).
- Validação de recurso no menu, nas rotas e obrigatoriamente no servidor, com mensagem de upgrade quando bloqueado.

## 9. Plano Teste

- Exclusivo do Administrador Master, sem cobrança e não contratável.
- Criação de empresa teste gera e-mail interno único (ex.: teste_a8f4d2@sistema.local), sem dados de pagamento.
- Master define início e quantidade de dias; expiração calculada automaticamente.
- Na expiração: status "Teste Expirado", bloqueio de login e de novos agendamentos, dados preservados.
- Painel Master mostra plano, status, início, expiração e dias restantes, destacando menos de 3 dias.
- Ações: renovar, alterar validade, converter em plano pago, encerrar antecipadamente — todas auditadas.

## 10. Prevenção de agendamentos duplicados

- Validação de profissional, data, início, fim, duração, intervalos e horário de funcionamento antes de confirmar.
- Proteção contra concorrência no banco (restrição de sobreposição por profissional), impedindo reservas simultâneas mesmo com dois pedidos ao mesmo tempo.
- Em caso de conflito: bloquear, sugerir horários alternativos e oferecer entrada na lista de espera.
- Em cancelamento: notificar o primeiro da fila, reservar o horário por tempo configurável e, sem confirmação, passar ao próximo.

## 11. Link de confirmação

- Revisão completa: geração do token, URL, rota pública, validação, expiração e redirecionamentos.
- Tela do cliente com nome e logo da empresa, cliente, serviço, profissional, data e horário.
- Ações: confirmar presença, solicitar reagendamento e cancelar (conforme regras da empresa).
- Ao confirmar: status Confirmado, data/hora, agenda atualizada, auditoria e notificação para recepção e profissional.
- Link inválido ou expirado exibe mensagem amigável, sem erro técnico.

## 12. Testes finais

Roteiro executado antes de concluir, com navegador automatizado e consultas ao banco: login, cadastro de empresa, cadastro de usuário, permissões por perfil, dashboards, agendamento e conflito, lista de espera, adição de serviço em andamento, finalização de serviço, comissão, financeiro, caixa, planos, plano teste e bloqueio, link de confirmação, página pública e auditoria.

## Detalhes técnicos

- Migração: índices únicos em `commissions(appointment_id, service_id, staff_id)`, `attendance_events(appointment_id, event)`, `financial_transactions(appointment_payment_id)`; revisão de `sync_appointment_commissions`, `log_attendance_event`, `apply_appointment_payment`, `consume_procedure_supplies`, `consume_plan_sessions`; restrição de exclusão por sobreposição de horários em `appointments` (btree_gist) ignorando cancelados.
- Novas tabelas: `subscription_plans` (catálogo e matriz de recursos), colunas de assinatura/teste em `companies`, reserva temporária em `waitlist_entries`.
- Funções SQL: `company_plan_features()`, `has_feature()`, `is_company_blocked()` — usadas nas políticas de acesso e nas funções de servidor.
- Camada de servidor: `completeAppointment`, `addServiceToAppointment`, `confirmAppointment`, `trialAdmin` em arquivos `*.functions.ts`, todos com verificação de permissão, de plano e de bloqueio.
- Frontend: `usePermissions`/`usePlanFeatures` como fonte única para menu, rotas e dashboards; mascaramento de contato reforçado no servidor.

## Observação de escopo

É uma entrega grande. Vou implementar tudo em sequência nesta mesma execução, começando pela correção crítica da finalização (itens 1, 2, 10 e 11), depois permissões e dashboards (3, 4, 5), depois planos e plano teste (8, 9), e por fim personalização e cadastro (6, 7), com os testes do item 12 ao final.

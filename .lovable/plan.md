## Escopo desta rodada

Só o bug do agendamento público (`/b/:slug`) — sem tocar em RBAC, RLS ou UI administrativa. Nada de refatoração de multi-tenant: a arquitetura atual (`company_users` + `is_super_admin` + `is_company_member` + RLS por `company_id`) fica intacta.

## Diagnóstico (causa raiz confirmada lendo `src/routes/b.$slug.index.tsx`)

1. **Datas todas desabilitadas** — `dateOptions` marca `disabled: !h || h.closed`. Se a empresa **não configurou `company_hours`** (caso da conta recém-criada), NENHUM dia tem row → todos os 14 dias saem desabilitados → o cliente não consegue clicar em nenhuma data.
2. **Nenhum horário aparece** — o `useMemo` de `slots` tem a mesma regra: sem row em `company_hours` retorna `[]`. Mesmo se o usuário forçasse uma data, não haveria horário.
3. **Não consegue finalizar** — consequência direta de (1) e (2): `timeStr` nunca é preenchido, então o botão "Confirmar" fica `disabled`. Não é bug do POST `/api/public/book` (o handler valida corretamente).
4. **Ordem do fluxo** — hoje são 4 passos (Serviços → Profissional → Data+Horário juntos → Contato). O pedido é separar Data e Horário e adicionar Confirmação explícita, sem mudar identidade visual.

## Alterações

### 1. `src/routes/b.$slug.index.tsx` — availability com fallback seguro

- **Fallback quando `company_hours` está vazio**: se a empresa não configurou nada, tratar como **aberto todos os dias, 09:00–18:00** (mesmo comportamento em `dateOptions` e `slots`). Isso atende "nunca deixar o calendário vazio por erro de configuração".
- **Respeitar `time_blocks`**: hoje o cálculo de `slots` só considera conflito com `appointments`. Passar a considerar também rows de `public.time_blocks` do dia/staff (já existe a tabela — 8 colunas, políticas em vigor) para bloqueios do administrador realmente sumirem no portal.
- **Respeitar `min_advance_min` / `max_advance_days`** da empresa em `dateOptions` e `slots`, para o front não oferecer horário que o servidor recusaria.
- **Sem regressão**: se `company_hours` TIVER config, o comportamento atual (respeitar `closed`, `start_time`, `end_time`) fica igual.

### 2. Reorganização do wizard para a ordem pedida

Passar de 4 para 6 passos visuais, mantendo componentes e estilos existentes (`Steps`, `Card`, botões, cores da empresa):

```text
1 Serviços  →  2 Profissional  →  3 Data  →  4 Horário  →  5 Dados  →  6 Confirmação
```

- Etapa "Unidade" **não** entra (cada unidade já tem seu próprio slug — resposta do usuário).
- Se `company.show_staff_on_portal === false`, pular a etapa 2 automaticamente (comportamento que já existe hoje, só re-mapeado para os novos números).
- Etapa 6 (Confirmação) mostra o `Summary` já existente + botão **Confirmar** (é onde o POST é disparado). O submit continua chamando `/api/public/book` sem mudanças.
- Barra inferior fixa e botão "Continuar / Voltar" seguem o mesmo padrão atual.

### 3. Nada além disso

- **Não** vou mexer em: schema do banco, RLS, `book.ts` (backend), páginas de admin, autenticação, fluxo de login, telas de configuração de horário/bloqueio. Elas já funcionam para os requisitos deste bug.
- **Não** vou adicionar novas tabelas nem migrations.

## Validação após implementar

- Empresa **sem** `company_hours` configurado → todas as 14 datas ficam clicáveis; horários de 09:00 às 18:00 aparecem em grade de 15 min; consigo finalizar até a mensagem de sucesso.
- Empresa **com** horário configurado (ex.: seg–sex 10–19, dom fechado) → domingos desabilitados, sábado desabilitado se não tiver row, horários dentro da janela configurada.
- Bloqueio criado em `/app/blocks` para amanhã 14:00–15:00 → aquele intervalo some da grade.
- `min_advance_min = 60` → horários nas próximas 60 min somem.
- Fluxo completo 6 passos → registro criado em `appointments`, cliente em `customers` com `source = "portal_publico"`, tela de sucesso renderiza.

## Detalhes técnicos

- Fallback aplicado dentro do `useMemo` de `slots` e `dateOptions` — helper local `resolveHours(weekday, hours)` que retorna `{ start: "09:00", end: "18:00", closed: false }` quando `hours.length === 0`, senão a row correspondente (ou `closed: true` se não houver row com `hours.length > 0`, mantendo semântica atual).
- `time_blocks` carregados via nova `useQuery` (`pub_blocks`), chave `[companyId, dateStr, staff?.id]`, com `.eq("company_id", companyId).gte("starts_at", dayStart).lte("starts_at", dayEnd)` e filtro opcional por `staff_id`.
- Novos estados de step: `useState<1|2|3|4|5|6>(1)`. Ajuste do array `labels` em `Steps` para `["Serviços","Profissional","Data","Horário","Dados","Confirmar"]`.
- Botão "Continuar" na etapa 5 troca por **Confirmar** somente na 6.

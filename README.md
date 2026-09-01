# Seu Agendamento

SaaS multiempresa para gestão de salões, barbearias, clínicas de estética e negócios de beleza.

Aplicação: https://seuagendamento.lovable.app

## Tecnologias

- React 19, TypeScript e TanStack Start
- Tailwind CSS e componentes Radix UI
- Supabase Auth, PostgreSQL, Storage e Row Level Security
- Fuso de exibição: `America/Sao_Paulo`

## Desenvolvimento

```sh
cp .env.example .env
npm install
npm run dev
```

Antes de enviar alterações:

```sh
npm run check
```

O comando executa lint, testes automatizados e build de produção.

## Variáveis de ambiente

As variáveis públicas do Supabase podem ser usadas pelo navegador. A variável
`SUPABASE_SERVICE_ROLE_KEY` é exclusiva do servidor e nunca deve ser incluída no Git,
em código cliente ou em valores com prefixo `VITE_`.

Consulte `.env.example` para a lista completa.

## WhatsApp

O envio é manual por link. O sistema normaliza o telefone, abre `wa.me` com a mensagem
preenchida e o usuário confirma o envio dentro do WhatsApp. Não existe envio automático
por API nesta versão.

## Banco e segurança

As alterações de banco ficam em `supabase/migrations`. Dados de cada empresa usam
`company_id` e políticas RLS. Novas tabelas comerciais devem habilitar RLS e validar
associação ou permissão da empresa antes de serem usadas na aplicação.

## Lovable

O projeto permanece sincronizado com o Lovable. Não reescreva o histórico publicado com
force push, rebase ou amend de commits já enviados.

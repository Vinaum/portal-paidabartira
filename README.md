# Portal da República Paidabartira

Comunidade, memória e networking da república Paidabartira (fundada em 4 de março de 2007).

**Estado atual: Etapa 3 (MVP) em andamento.**

| Módulo | Situação |
| --- | --- |
| Fundação: identidade visual, banco com RLS, autenticação | Pronto |
| Solicitação e aprovação de acesso, convite | Pronto |
| Perfis e privacidade (vários períodos na república, formação, redes sociais, visibilidade por seção) | Pronto, exceto foto |
| Foto de perfil, diretório, eventos, caixinha, dashboard, portal público completo | A fazer |

## Tecnologias

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 ·
Zod · Supabase (Auth, PostgreSQL com RLS, Storage) · Vitest · pgTAP.

## Começar

```bash
npm install
cp .env.example .env.local   # preencha com os dados do projeto Supabase
npm run dev                  # http://localhost:3000
```

Sem `.env.local` o portal público funciona e as áreas restritas ficam fechadas.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run check` | Lint, tipos, testes unitários e build |
| `npm run test` | Testes unitários (Vitest) |
| `npm run test:db` | Migrations + testes de RLS em um Postgres comum (ver abaixo) |
| `npx supabase test db` | Os mesmos testes no Supabase local (exige Docker) |

## Estrutura

```text
src/app/(publico)   portal público (/, /solicitar-acesso, /privacidade, /estilo)
src/app/(auth)      /login, /recuperar-senha, /definir-senha
src/app/auth        /auth/confirm (destino dos links de e-mail)
src/app/(membros)   área restrita (/painel, /perfil)
src/app/admin       painel administrativo (/admin, /admin/solicitacoes)
src/features        lógica por domínio (actions, schemas, componentes)
src/components      componentes de interface reutilizáveis
src/lib             Supabase, sessão, permissões, rotas
src/config/site.ts  nome e dados da república
supabase/migrations esquema, RLS e funções (SQL versionado)
supabase/tests      testes pgTAP de acesso negado
docs/               guias de Supabase, deploy, segurança e backup
```

## Segurança em três camadas

1. `src/proxy.ts` renova a sessão e barra anônimos nas rotas restritas.
2. Os layouts de `(membros)` e `admin` conferem status e permissão no servidor.
3. A RLS do Postgres decide em definitivo. Detalhes em `docs/seguranca.md`.

## Testes de banco sem Docker

`scripts/test-db.sh` aplica um *shim* (`scripts/support/supabase_shim.sql`) que
imita os objetos do Supabase (`auth.users`, `auth.uid()`, papéis, `storage.objects`) em
um Postgres 16 comum com pgTAP, aplica as migrations e roda os testes:

```bash
PGHOST=/tmp PGPORT=54329 PGUSER=postgres npm run test:db
```

O shim é uma aproximação. A verificação definitiva é `supabase test db`, que roda no CI
(`.github/workflows/ci.yml`) com a imagem oficial do Supabase.

## Documentação

- `docs/supabase.md`: criar o projeto, aplicar migrations, e-mails, primeiro superadmin
- `docs/deploy.md`: GitHub e Vercel
- `docs/seguranca.md`: modelo de permissões, RLS e convenções obrigatórias
- `docs/backup.md`: limites do plano gratuito, backup e recuperação

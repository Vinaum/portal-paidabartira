# Guia de configuração do Supabase

Tempo estimado: 30 minutos. Faça uma vez para produção e, se quiser homologação, repita
em um segundo projeto gratuito.

## 1. Criar o projeto

1. Em <https://supabase.com/dashboard>, **New project**.
2. Região: **South America (São Paulo)**.
3. Guarde a senha do banco em um gerenciador de senhas. Ela não vai para o repositório.

## 2. Aplicar as migrations

Com a Supabase CLI (`npx supabase`):

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```

`db push` aplica, em ordem, os arquivos de `supabase/migrations/`. Nunca edite uma
migration já aplicada: crie uma nova.

**Não aplique** `supabase/tests/support/supabase_shim.sql` em um projeto real. Ele existe
só para testes em Postgres comum.

## 3. Autenticação

Em **Authentication > Sign In / Providers**:

- **Allow new users to sign up: desligado.** Contas nascem só por convite.
- **Confirm email: ligado.**
- Senha mínima: **10** caracteres.

Em **Authentication > URL Configuration**:

- **Site URL**: o endereço do site (ex.: `https://portal-paidabartira.vercel.app`).
- **Redirect URLs**: o mesmo endereço seguido de `/**`.

## 4. Modelos de e-mail

Em **Authentication > Emails**, troque o link de cada modelo para apontar ao portal.
O portal mostra um botão "Continuar" antes de consumir o link, o que evita que antivírus
de e-mail gastem o convite.

| Modelo | Link a usar no `href` |
| --- | --- |
| Invite user | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` |
| Reset password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |
| Change email address | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email_change` |

## 5. Envio de e-mails (SMTP)

O e-mail embutido do Supabase serve apenas para teste: envia 2 mensagens por hora e só
para endereços da equipe do projeto. Para convidar integrantes de verdade, configure
**Authentication > Emails > SMTP Settings** com um provedor e um domínio verificado.
Pendência registrada: confirmar o domínio `paidabartira.com` e quem acessa o DNS.

Enquanto isso, dá para testar tudo com o e-mail do próprio dono do projeto.

## 6. Chaves para a aplicação

Em **Project Settings > API Keys**:

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_...`). Só na Vercel e no `.env.local` |

A chave secreta ignora a RLS. Não a cole em conversas, issues ou commits. Se vazar,
revogue-a no mesmo painel e gere outra.

## 7. Primeiro superadmin

Só é possível enquanto não existir nenhum superadmin.

1. **Authentication > Users > Add user > Send invitation**, com o e-mail do superadmin.
   Ainda não abra o e-mail.
2. No **SQL Editor**, rode (ajuste os valores):

```sql
select private.bootstrap_superadmin(
  'email-do-superadmin@exemplo.com',  -- mesmo e-mail do passo 1
  'Nome Completo',
  'ex_morador',                        -- atual_morador | ex_morador | agregado
  false,                               -- fundador? (só vale para ex_morador)
  'Apelido'
);
```

3. Agora abra o e-mail, clique no link, confirme e defina a senha no portal.
4. Você cai em `/painel`, que deve mostrar o selo **Superadmin**.

A função recusa a execução se já houver um superadmin e registra a operação em
`audit_logs`. Recomenda-se promover um segundo superadmin pelo painel (Etapa 3).

## 8. Conferência

No **SQL Editor**, todas as tabelas de `public` devem estar com RLS ligada:

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
```

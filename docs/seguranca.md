# Segurança: modelo e convenções

## Papéis, categorias e permissões

- **Categoria** (atual morador, ex-morador, agregado) e **fundador** são descritivos.
  Não concedem permissão.
- **Papel** (membro, moderador, administrador, superadmin) define o que a pessoa faz.
- A tabela `role_permissions` guarda as permissões de moderador e administrador.
  O superadmin tem todas, de forma implícita. Só o superadmin edita a matriz, e só a
  linha do administrador.
- Os nomes das permissões existem em dois lugares que um teste mantém iguais:
  `src/lib/permissions.ts` e a migration `..._base.sql`.

## Por que o usuário não consegue se promover

`members` (categoria, fundador, papel, status) não tem nenhuma política de escrita para
usuários. Toda alteração passa por funções `admin_*`, que conferem a permissão, impedem
alterar a si mesmo, restringem papéis altos ao superadmin e gravam auditoria.
A solicitação de acesso aceita, por `GRANT` de coluna, apenas os campos do formulário.

## Privacidade por seção

A RLS protege linhas, não colunas. Por isso cada seção de privacidade é uma tabela:
`profile_photo`, `profile_emails`, `profile_phone`, `profile_address`,
`profile_professional` e `education`. Todas usam `private.can_view_section`:

| Visibilidade | Quem lê |
| --- | --- |
| dono | sempre |
| `public` | membros ativos; anônimos só se o dono autorizou aparecer no portal |
| `members` | membros ativos |
| `private` | só o dono. Administradores **não** leem |

Padrões na criação da conta: telefone e endereço privados; as demais, somente membros.

## Convenções obrigatórias para novas migrations

1. Toda tabela: `enable row level security` na mesma migration em que é criada, e `grant` explícito do que `anon` e `authenticated` precisam. Desde a migration `..._explicit_grants.sql`, nada é concedido automaticamente.
2. Políticas explícitas por operação e por papel (`to anon`, `to authenticated`).
3. Funções `security definer` sempre com `set search_path = ''` e, de preferência, no
   esquema `private` (não exposto pela API).
4. Ao criar funções, terminar a migration com `revoke execute ... from public, anon,
   authenticated` e conceder por nome só o necessário (ver `..._function_grants.sql`).
5. Nunca usar `user_metadata` em políticas: o próprio usuário consegue alterá-lo.
6. Cada política nova ganha um teste de acesso negado em `supabase/tests/database/`.
7. Registros financeiros e de auditoria são somente inserção.

## Convenções na aplicação

- Leitura e escrita usam `lib/supabase/server.ts` (sessão do usuário, com RLS).
- `lib/supabase/admin.ts` é o único arquivo que lê `SUPABASE_SECRET_KEY`, importa
  `server-only` e só serve a convite, suspensão e exclusão de conta no Auth.
- Toda Server Action valida a entrada com Zod e confere a permissão no servidor.
- Páginas restritas chamam `requireActiveMember()` ou `requirePermission()` ao buscar
  dados. O layout sozinho não é barreira.
- Redirecionamentos pós-login passam por `safeNextPath` (só caminhos internos).
- Mensagens de login e de recuperação não revelam se um e-mail tem conta.

## Diretório e foto de perfil

- A busca do diretório é a função `search_directory`, `SECURITY INVOKER`: roda com os
  direitos de quem chama, então a RLS de cada seção decide o que aparece. Dado que o dono
  escondeu volta nulo e também não casa com filtro (não dá para descobrir a empresa de
  alguém filtrando por ela). Os testes estão em `04_directory.test.sql`.
- Os filtros viajam na URL (formulário GET), são validados com Zod e passam ao banco como
  parâmetros; os curingas do `LIKE` são escapados.
- A foto fica no bucket privado `member-media`. O servidor decodifica o arquivo com `sharp`,
  recusa o que não for imagem, recorta em 512 px e regrava em WebP, o que descarta metadados
  (inclusive GPS). A leitura usa URLs assinadas de 1 hora; a política do storage confere a
  visibilidade da seção "foto" do dono.
- Pedido de exclusão de conta: um por vez, abre uma solicitação em `data_requests`; a
  análise pela administração entra com o módulo de administração.

## O que ainda não está coberto

- Política de Segurança de Conteúdo (CSP) estrita. Entram hoje os cabeçalhos básicos
  (`next.config.ts`).
- Limite de tentativas próprio nos formulários públicos. O Supabase Auth já limita
  login e envio de e-mails; o formulário de solicitação (Etapa 3) terá limite próprio.
- Testes de ponta a ponta (Playwright) contra um Supabase real: dependem do projeto criado.

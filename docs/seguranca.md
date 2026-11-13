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

## Administração de integrantes e pedidos de dados

- As leituras administrativas são funções `SECURITY DEFINER` (`admin_list_members`,
  `admin_get_member`, `admin_member_history`, `admin_list_data_requests`) que conferem a
  permissão logo na entrada e devolvem só as colunas necessárias: nenhuma seção privada do
  perfil. O e-mail de login aparece apenas no detalhe, para quem tem `members.manage`.
- Alterações passam por `admin_update_member`, `admin_set_member_role` e
  `admin_resolve_data_request`, que gravam histórico e auditoria. Ninguém altera o próprio
  vínculo; só o superadmin mexe em administradores.
- Suspender ou desativar vale na hora pelo banco (a RLS barra a cada requisição) e também
  bloqueia o login no Auth (`ban_duration`). Se o bloqueio no Auth falhar, a tela avisa e o
  banco continua sendo a autoridade.
- A auditoria de `data_requests` não guarda texto livre (motivo e resposta), porque ela é
  imutável e sobrevive à exclusão da conta.
- Exclusão de conta (pedido do titular), em passos: o banco valida e apaga a solicitação de
  acesso original (nome, e-mail, telefone); o servidor apaga os arquivos do storage e o
  usuário no Auth (o restante cai em cascata); o banco confere e registra. Conta de
  superadmin não é excluída por aqui; administrador só por superadmin; ninguém executa a
  própria. Se um passo falha, o pedido continua "em análise" e pode ser repetido.
- Permanecem após a exclusão: registros de auditoria (identificador e papel, sem nome nem
  texto livre) e o histórico de quem alterou o quê em outras pessoas.

## Eventos

- Visitante lê só eventos públicos publicados ou cancelados, e só as colunas de apresentação
  (sem `created_by`). Integrante ativo lê todos os publicados ou cancelados. Rascunhos, só
  para quem tem `events.manage`, que também escreve (a RLS confere; a ação confere de novo).
- Evento publicado não se apaga, se cancela (fica o registro); só rascunho se apaga.
- Confirmação de presença: só integrante ativo, em nome próprio, em evento publicado que
  ainda não terminou. Quem vai aparece pelo nome de apresentação, apenas para integrantes
  ativos (`event_attendees` é `SECURITY INVOKER`). Testes em `06_events.test.sql`.
- Horários: o banco guarda o instante; o formulário trabalha em horário de Brasília e a
  conversão fica em `features/eventos/time.ts` (com testes).

## O que ainda não está coberto

- Política de Segurança de Conteúdo (CSP) estrita. Entram hoje os cabeçalhos básicos
  (`next.config.ts`).
- Limite de tentativas próprio nos formulários públicos. O Supabase Auth já limita
  login e envio de e-mails; o formulário de solicitação (Etapa 3) terá limite próprio.
- Testes de ponta a ponta (Playwright) contra um Supabase real: dependem do projeto criado.

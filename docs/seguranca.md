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

## Caixinha (transparência financeira)

- **Várias caixinhas.** Cada uma tem meta opcional, visibilidade (`public` ou `members`) e PIX opcional. Dinheiro sempre em centavos inteiros.
- **Quem lança.** Quem tem `finance.write` (administrador, superadmin) ou foi designado *responsável* por aquela caixinha (`fund_managers`). A designação é por caixinha, não um papel global, então um moderador ou integrante comum pode ser responsável e pode haver vários.
- **Quem vê o quê.** Visitante: só o total arrecadado, a meta e o PIX de caixinhas públicas ativas. Integrante ativo: também saídas (uma a uma, com descrição), saldo e entradas somadas por mês. Descrição de entrada só aparece para quem gerencia. **Doadores não são registrados** em nenhum campo estruturado.
- **Livro imutável.** `ledger_entries` não aceita UPDATE nem DELETE (gatilho) nem TRUNCATE. Correção é por estorno (`reverses_id`, único, mesmo valor e tipo). O saldo nunca fica negativo (gatilho com trava na linha da caixinha). A única mudança tolerada é `created_by` virar nulo quando a conta é excluída (LGPD).
- **Auditoria.** Criar/alterar caixinha, lançar, estornar e designar responsável vão para `audit_logs`, sem texto livre e sem a chave PIX.
- **Limitação conhecida.** Como entradas aparecem somadas por mês, um mês com uma única entrada revela o valor dela (não quem pagou). Se isso incomodar, agrupar por trimestre é uma mudança pequena em `fund_cashflow`.
- **Futuro: Associação.** Uma área só para associados exigirá novo valor em `fund_visibility` (`ADD VALUE 'associates'`) e uma tabela de associados; não está implementado.

## Loja (catálogo e pedidos)

- **Sem pagamento no site.** O integrante faz o pedido; o pagamento (PIX) é combinado fora e o pedido segue por `requested → confirmed → paid → delivered` (ou `cancelled`). As transições são validadas no banco; o integrante só cancela o que ainda não foi confirmado.
- **Visibilidade por produto.** `public` (visitantes veem, p.ex. festas abertas) ou `members`. Rascunhos só aparecem para quem gerencia. A RLS decide; a página não filtra por conta própria.
- **Quem pede.** Só integrante ativo (função `shop_request_order`, que valida tamanho, quantidade, disponibilidade e limita a 10 pedidos aguardando).
- **Quem gerencia.** `store.manage` (administrador, superadmin) e *responsáveis da loja* designados por eles (`shop_managers`). Responsáveis não designam outros.
- **Pedido guarda cópia** de nome, preço e orientações de pagamento da época; alterar o produto não muda pedidos antigos. Ao excluir uma conta (LGPD), o pedido permanece sem vínculo com a pessoa.
- **Fotos.** Bucket privado `shop-media`, sem política para o cliente; só o servidor grava (re-encodado em WebP, sem metadados) e entrega endereços assinados de 1 h dos produtos que a RLS já liberou.
- **Auditoria** de produtos, pedidos e responsáveis, sem texto livre dos pedidos.
- **Limitação.** Produto "só para quem já morou ou é agregado" hoje vira "só integrantes" (inclui moradores atuais). Restringir por categoria é uma coluna a mais, se necessário.

## Comunicados e histórias

- **Comunicados.** Publica quem tem `announcements.publish` (administrador e moderador). Cada comunicado é `public` ou `members`, pode ser fixado e ter validade; depois da validade some para leitores (quem publica ainda vê). Criar, editar e apagar vão para a auditoria (título, sem o texto).
- **Histórias.** Só integrante ativo lê e escreve; publica na hora e a moderação (`stories.moderate`) oculta depois, com motivo visível ao autor. Autor edita e apaga a sua; moderador não edita texto alheio. Ocultas somem para os demais e não aceitam comentários.
- **Fotos de histórias.** Até 4, bucket privado `story-media`, caminho `autor/história/arquivo.webp`; o servidor re-encoda em WebP (sem GPS) e entrega URLs assinadas de 1 h de histórias que a RLS liberou. A exclusão de conta (LGPD) apaga as pastas da pessoa nos dois buckets (`member-media` e `story-media`) e as histórias e comentários dela saem junto.
- **Nomes.** Autor e comentaristas aparecem pelo nome de exibição (`member_names`, só para integrantes ativos), mesmo se a pessoa se esconde do diretório: quem escreve numa história escolhe assinar.
- **Auditoria.** Criação, exclusão, ocultação e reexibição de histórias e remoção de comentário por moderador registram só ids, nunca o texto.
- **Moderação no admin.** `/admin/historias` lista todas as histórias (inclusive ocultas) com o botão de ocultar e reexibir; só quem tem `stories.moderate`.
- **Limitações.** Não há limite de taxa nos comentários nem denúncia pelos leitores; a moderação depende de quem tem a permissão. Edição de comentário não existe (apaga e escreve de novo).

## Aniversários na agenda

- **Minimização.** Só dia e mês são guardados (`profile_birthday`), nunca o ano: não há como calcular idade. 29/02 aparece em 28/02 nos anos comuns.
- **Quem aparece.** Só quem preencheu e deixou a seção `birthday` visível a integrantes (padrão para novos integrantes; sem dado, nada aparece). A regra é a mesma das outras seções (`can_view_section`): quem escolhe "privado" some da agenda dos outros e continua vendo o próprio. Integrante suspenso ou inativo não aparece.
- **Nunca público.** A tabela não tem acesso para visitantes e `list_birthdays()` (invoker, sujeita à RLS) só é executável por contas autenticadas. A opção "público" do seletor, para esta seção, equivale a "integrantes".
- **Onde aparece.** Na agenda (próximos 90 dias, intercalado com os eventos) e no painel (próximos 30 dias). Não há aniversários na agenda de eventos passados nem no portal público.

## Portal público e painel

- **Quem aparece.** `public_people()` (definer, executável por visitantes) devolve só integrantes ativos que marcaram "aparecer no portal público", nas categorias morador atual e ex-morador (agregados não aparecem). Campos: nome de exibição, apelido, apresentação, categoria, fundador e foto (apenas se a seção foto estiver pública). O período na casa continua restrito a integrantes.
- **Números.** `public_house_stats()` devolve contagens agregadas (moram hoje, já moraram, fundadores), sem identificar ninguém.
- **Conteúdo institucional.** Texto da história, e-mail de contato e foto da casa ficam em `republic_settings` (chaves públicas) e se editam em `/admin/conteudo` (`settings.manage`). A foto é regravada em WebP no bucket público `public-media`; mudanças vão para a auditoria genérica de configurações.
- **Painel.** Pendências (solicitações de acesso, pedidos LGPD, pedidos da loja) só aparecem para quem tem a permissão correspondente. O resumo de caixinhas mostra o que cada integrante já pode ver em `/financeiro`.

## O que ainda não está coberto

- Política de Segurança de Conteúdo (CSP) estrita. Entram hoje os cabeçalhos básicos
  (`next.config.ts`).
- Limite de tentativas próprio nos formulários públicos. O Supabase Auth já limita
  login e envio de e-mails; o formulário de solicitação (Etapa 3) terá limite próprio.
- Testes de ponta a ponta (Playwright) contra um Supabase real: dependem do projeto criado.

## Política de privacidade

- O texto fica em `src/app/(publico)/privacidade/page.tsx` e a versão em `POLICY_VERSION`
  (`src/features/acesso/schemas.ts`). Cada versão precisa de uma linha em
  `privacy_policy_versions` (migration), porque o pedido de acesso grava a versão aceita.
- Versão `2026-11-13`: passou a cobrir aniversário, histórias, comentários, agenda, loja, caixinha
  e a lista pública, e detalha o que a exclusão de conta apaga ou mantém anonimizado.
- Sempre que um módulo novo tratar dados pessoais, atualize o texto e publique uma nova versão.
- Pendências: revisão jurídica e aviso aos integrantes já ativos sobre a nova versão
  (por exemplo, um comunicado).
- Versão `2026-11-14`: acrescenta o Museu.

## Museu

- `albums` (visibilidade `public`/`members`, oculto pela moderação) e `album_photos` (quem enviou,
  legenda, oculta). Sem marcação de pessoas: menos dado pessoal e menos pedidos de remoção.
- Qualquer integrante ativo cria álbum e envia foto a álbum não oculto. Edita e apaga o álbum
  quem o criou; apaga uma foto quem a enviou ou quem criou o álbum. A moderação
  (`stories.moderate`, via `museum_set_hidden`) oculta álbum ou foto; o texto e o arquivo ficam.
- Visitantes (RLS `anon`) só leem álbum público e não oculto e suas fotos não ocultas. As fotos
  ficam em bucket privado (`museum-media`); o servidor assina a URL (1 h) só depois de a RLS
  liberar a linha. O nome de quem criou o álbum só aparece para integrantes.
- Fotos são regravadas em WebP (sem EXIF/GPS). Limite de 100 fotos por álbum (gatilho).
- Exclusão de conta: as fotos enviadas são apagadas (linhas por `cascade`, arquivos pela pasta
  do integrante); álbuns criados continuam com `created_by` nulo.
- Auditoria: ids, visibilidade e ocultação; nunca título, descrição ou legenda.
- Risco aceito: um álbum público com foto enviada por outro integrante expõe quem aparece nela.
  Mitigação: aviso no formulário, moderação e remoção pelo contato da política.

## Loja: carrinho e PIX

- Pedido com vários itens: `shop_orders` (cabeçalho, status, total) e `shop_order_items` (nome e
  preço "congelados"). Só são criados por `shop_checkout`, função que relê produto, preço,
  tamanho e disponibilidade no banco; nada vem confiável do navegador. Os pedidos antigos foram
  copiados pela migration (mesmo id) e `product_orders` foi removida.
- Carrinho: cookie `pdbt_cart` (httpOnly, SameSite=Lax, 30 dias) com produto, tamanho e quantidade,
  validado com Zod a cada leitura. Preço e disponibilidade são lidos do banco ao exibir e ao
  finalizar. Cookie adulterado vira carrinho vazio.
- PIX: a chave fica em `shop_settings` (uma só, lida por integrantes ativos e responsáveis, alterada
  só com `store.manage`, auditoria sem a chave). O QR é gerado no servidor (`pix.ts`, BR Code
  estático com CRC16) e não há retorno de pagamento: quem gerencia a loja confere o PIX no banco e
  marca o pedido como pago (`requested -> paid` é permitido).
- Risco aceito: quem tem `store.manage` pode trocar a chave e desviar pagamentos. Mitigação: só
  administração, trilha de auditoria da troca e aviso na tela. Chave de pessoa física até existir
  a Associação.
- Versão `2026-11-14.2` da política: cookie do carrinho e QR do PIX.

## Cabeçalho público e carrinho

- As páginas públicas são pré-renderizadas; por isso o botão "Entrar / Meu painel" e o ícone do
  carrinho vêm de `GET /api/sessao` (só `loggedIn` e `cartCount`, sem dado pessoal, `no-store`),
  consultado no navegador depois de carregar. Renderizar a sessão no servidor dentro da página
  pré-renderizada causava erro de hidratação para quem estava logado.
- Nas áreas restritas o contador é lido do cookie no servidor. Adicionar ao carrinho e finalizar
  navegam pelo cliente (e não por `redirect`), porque mexer no cookie atualiza a página atual.

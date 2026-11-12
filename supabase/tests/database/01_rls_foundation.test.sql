-- Testes de acesso não autorizado da fundação (Etapa 2).
-- Identidades: anônimo, membro A, membro B, suspenso, convidado (sem vínculo),
-- moderador, administrador e superadmin.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(66);

-- ---------------------------------------------------------------------------
-- Cenário (criado como dono do banco, fora da RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test'),
  ('00000000-0000-0000-0000-00000000000c', 'suspenso@example.test'),
  ('00000000-0000-0000-0000-00000000000d', 'moderador@example.test'),
  ('00000000-0000-0000-0000-00000000000e', 'admin@example.test'),
  ('00000000-0000-0000-0000-00000000000f', 'super@example.test'),
  ('00000000-0000-0000-0000-000000000010', 'convidado@example.test'),
  ('00000000-0000-0000-0000-000000000011', 'admin2@example.test');

select private.create_member('00000000-0000-0000-0000-00000000000a', 'atual_morador', false, 'membro', 'Membro A da Silva', 'Aaa', null);
select private.create_member('00000000-0000-0000-0000-00000000000b', 'ex_morador', true, 'membro', 'Membro B de Souza', 'Bbb', null);
select private.create_member('00000000-0000-0000-0000-00000000000c', 'agregado', false, 'membro', 'Suspenso Pereira', null, null);
select private.create_member('00000000-0000-0000-0000-00000000000d', 'atual_morador', false, 'moderador', 'Moderador Lima', null, null);
select private.create_member('00000000-0000-0000-0000-00000000000e', 'ex_morador', false, 'administrador', 'Admin Costa', null, null);
select private.create_member('00000000-0000-0000-0000-00000000000f', 'ex_morador', true, 'superadmin', 'Super Alves', null, null);
select private.create_member('00000000-0000-0000-0000-000000000011', 'ex_morador', false, 'administrador', 'Admin Dois', null, null);
update public.members set status = 'suspended' where id = '00000000-0000-0000-0000-00000000000c';

-- Membro B: telefone privado (padrão), profissional só membros, e-mail público,
-- e autorizou aparecer no portal público.
insert into public.profile_phone (member_id, phone) values ('00000000-0000-0000-0000-00000000000b', '+55 19 99999-0000');
insert into public.profile_professional (member_id, company) values ('00000000-0000-0000-0000-00000000000b', 'Empresa B');
insert into public.profile_emails (member_id, official_email) values ('00000000-0000-0000-0000-00000000000b', 'b.oficial@example.test');
update public.profile_privacy set visibility = 'public'
  where member_id = '00000000-0000-0000-0000-00000000000b' and section = 'emails';
update public.profiles set show_on_public_portal = true where member_id = '00000000-0000-0000-0000-00000000000b';
-- Membro B começa com a foto pública (o padrão é "somente membros").
insert into public.profile_photo (member_id, media_path)
  values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b/avatar/foto.webp');
update public.profile_privacy set visibility = 'public'
  where member_id = '00000000-0000-0000-0000-00000000000b' and section = 'photo';
-- Membro A: e-mail "público", mas NÃO autorizou o portal público.
insert into public.profile_emails (member_id, official_email) values ('00000000-0000-0000-0000-00000000000a', 'a.oficial@example.test');
update public.profile_privacy set visibility = 'public'
  where member_id = '00000000-0000-0000-0000-00000000000a' and section = 'emails';

insert into public.membership_requests (id, full_name, email, relationship, justification, policy_version)
values ('10000000-0000-0000-0000-000000000001', 'Convidado Teste', 'convidado@example.test', 'Ex-morador', 'Morei na república em 2010.', '2026-11');

insert into storage.objects (bucket_id, name) values
  ('member-media', '00000000-0000-0000-0000-00000000000b/avatar/foto.webp'),
  ('member-media', '00000000-0000-0000-0000-00000000000b/historias/x.webp');

create function public.t_login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
create function public.t_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end $$;
grant execute on function public.t_login(uuid), public.t_anon() to anon, authenticated;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Anônimo
-- ---------------------------------------------------------------------------
select public.t_anon();

select throws_ok('select * from public.members', '42501', null, 'anônimo não lê members');
select throws_ok('select * from public.membership_requests', '42501', null, 'anônimo não lê solicitações');
select throws_ok('select * from public.audit_logs', '42501', null, 'anônimo não lê auditoria');
select throws_ok('select full_name from public.profiles', '42501', null, 'anônimo não lê nome completo');
select results_eq(
  'select display_name from public.profiles order by 1',
  array['Bbb'],
  'anônimo só vê quem autorizou o portal público');
select results_eq(
  'select official_email from public.profile_emails',
  array['b.oficial@example.test'],
  'seção pública só aparece ao anônimo se o dono autorizou o portal');
select is_empty('select * from public.profile_phone', 'anônimo não vê telefone');
select is_empty('select * from public.profile_professional', 'anônimo não vê seção "somente membros"');
select throws_ok(
  $$insert into public.membership_requests (full_name, email, relationship, justification, policy_version)
    values ('Visitante Novo', 'novo@example.test', 'Agregado', 'Amigo da casa desde 2015.', '2026-11')$$,
  '42501', null, 'anônimo não insere solicitação direto na tabela');
select throws_ok(
  $$insert into public.membership_requests (full_name, email, relationship, justification, policy_version, assigned_role)
    values ('Esperto', 'esperto@example.test', 'x1', 'Quero ser superadmin já.', '2026-11', 'superadmin')$$,
  '42501', null, 'anônimo não escolhe o próprio papel');
select throws_ok(
  $$insert into public.membership_requests (full_name, email, relationship, justification, policy_version, assigned_is_founder, assigned_category)
    values ('Esperto', 'esperto2@example.test', 'x1', 'Sou fundador, confia.', '2026-11', true, 'ex_morador')$$,
  '42501', null, 'anônimo não se declara fundador');
select throws_ok('select public.activate_membership()', '42501', null, 'anônimo não executa RPC');
select throws_ok(
  $$select public.admin_review_request('10000000-0000-0000-0000-000000000001', 'approve', 'ex_morador')$$,
  '42501', null, 'anônimo não aprova solicitação');
select results_eq(
  $$select name from storage.objects where bucket_id = 'member-media' order by 1$$,
  array['00000000-0000-0000-0000-00000000000b/avatar/foto.webp'],
  'anônimo enxerga só o avatar público de quem autorizou o portal');
reset role;
-- B restringe a foto a "somente membros": o anônimo deixa de enxergar.
select set_config('request.jwt.claims', '', true);
update public.profile_privacy set visibility = 'members'
  where member_id = '00000000-0000-0000-0000-00000000000b' and section = 'photo';
select public.t_anon();
select is_empty(
  $$select name from storage.objects where bucket_id = 'member-media'$$,
  'anônimo não enxerga avatar com visibilidade "somente membros"');
select is_empty('select * from public.profile_photo', 'anônimo não lê profile_photo "somente membros"');
select is_empty(
  $$select * from public.republic_settings where not is_public$$,
  'anônimo só lê configurações públicas');

-- ---------------------------------------------------------------------------
-- Membro A
-- ---------------------------------------------------------------------------
reset role;
select public.t_login('00000000-0000-0000-0000-00000000000a');

select is(
  (select count(*)::int from public.members),
  6, 'membro vê os 6 integrantes ativos e não o suspenso');
select is_empty(
  $$select * from public.profile_phone where member_id = '00000000-0000-0000-0000-00000000000b'$$,
  'membro A não lê telefone privado de B');
select results_eq(
  $$select company from public.profile_professional where member_id = '00000000-0000-0000-0000-00000000000b'$$,
  array['Empresa B'], 'membro A lê seção "somente membros" de B');
select is_empty(
  $$select * from public.profile_privacy where member_id = '00000000-0000-0000-0000-00000000000b'$$,
  'membro A não lê as preferências de privacidade de B');
select is_empty(
  $$update public.profiles set bio = 'invadido' where member_id = '00000000-0000-0000-0000-00000000000b' returning 1$$,
  'membro A não edita perfil de B');
select lives_ok(
  $$update public.profiles set bio = 'Minha bio' where member_id = '00000000-0000-0000-0000-00000000000a'$$,
  'membro A edita o próprio perfil');
select throws_ok(
  $$insert into public.profile_phone (member_id, phone) values ('00000000-0000-0000-0000-00000000000b', '1')$$,
  null, null, 'membro A não grava seção de B');
select throws_ok(
  $$update public.members set role = 'superadmin' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'membro não altera o próprio papel direto na tabela');
select throws_ok(
  $$update public.members set is_founder = true, category = 'ex_morador' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '42501', null, 'membro não se declara fundador');
select throws_ok(
  $$select public.admin_set_member_role('00000000-0000-0000-0000-00000000000a', 'administrador')$$,
  '42501', null, 'membro não se promove por RPC');
select throws_ok(
  $$select public.admin_set_member_role('00000000-0000-0000-0000-00000000000b', 'moderador')$$,
  '42501', null, 'membro não promove outro');
select throws_ok(
  $$select public.admin_update_member('00000000-0000-0000-0000-00000000000b', 'ex_morador', true, 'suspended')$$,
  '42501', null, 'membro não suspende outro');
select is_empty('select * from public.membership_requests', 'membro não lê solicitações');
select is_empty('select * from public.audit_logs', 'membro não lê auditoria');
select throws_ok(
  $$insert into public.role_permissions (role, permission) values ('administrador', 'audit.read')$$,
  null, null, 'membro não edita a matriz de permissões');
select throws_ok('select private.bootstrap_superadmin(''a@example.test'', ''A'', ''ex_morador'')',
  '42501', null, 'membro não executa o bootstrap de superadmin');
select throws_ok(
  $$select private.create_member('00000000-0000-0000-0000-000000000010', 'ex_morador', true, 'superadmin', 'Xis', null, null)$$,
  '42501', null, 'membro não executa create_member');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'member-media'),
  1, 'membro A vê o avatar de B, mas não os outros arquivos de B');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('member-media', '00000000-0000-0000-0000-00000000000b/avatar/x.webp')$$,
  null, null, 'membro A não grava na pasta de B');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('member-media', '00000000-0000-0000-0000-00000000000a/avatar/eu.webp')$$,
  'membro A grava na própria pasta');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('public-media', 'logo.png')$$,
  null, null, 'membro não grava no bucket público');
select throws_ok(
  $$insert into public.data_requests (member_id, kind) values ('00000000-0000-0000-0000-00000000000b', 'deletion')$$,
  null, null, 'membro A não pede exclusão em nome de B');
select lives_ok(
  $$insert into public.data_requests (member_id, kind) values ('00000000-0000-0000-0000-00000000000a', 'correction')$$,
  'membro A registra pedido sobre os próprios dados');

-- ---------------------------------------------------------------------------
-- Suspenso e convidado sem vínculo
-- ---------------------------------------------------------------------------
reset role;
select public.t_login('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.members), 1, 'suspenso só lê a própria linha de members');
select is(
  (select count(*)::int from public.profiles where member_id <> '00000000-0000-0000-0000-00000000000c'),
  0, 'suspenso não lê perfis alheios');
select is_empty('select * from public.profile_professional', 'suspenso não lê seções de membros');
select is_empty(
  $$update public.profiles set bio = 'x' where member_id = '00000000-0000-0000-0000-00000000000c' returning 1$$,
  'suspenso não edita nem o próprio perfil');
select is_empty('select public.my_permissions()', 'suspenso não tem permissões');

reset role;
select public.t_login('00000000-0000-0000-0000-000000000010');
select is_empty('select * from public.members', 'conta sem vínculo não lê members');
select throws_ok('select public.activate_membership()', '42501', null,
  'conta sem convite registrado não se ativa');

-- ---------------------------------------------------------------------------
-- Moderador
-- ---------------------------------------------------------------------------
reset role;
select public.t_login('00000000-0000-0000-0000-00000000000d');
select is_empty('select * from public.membership_requests', 'moderador não lê solicitações');
select throws_ok(
  $$select public.admin_update_member('00000000-0000-0000-0000-00000000000a', 'ex_morador', false, 'suspended')$$,
  '42501', null, 'moderador não suspende integrantes');
select is_empty(
  $$select * from public.profile_phone where member_id = '00000000-0000-0000-0000-00000000000b'$$,
  'moderador não lê telefone privado');

-- ---------------------------------------------------------------------------
-- Administrador
-- ---------------------------------------------------------------------------
reset role;
select public.t_login('00000000-0000-0000-0000-00000000000e');
select is_empty(
  $$select * from public.profile_phone where member_id = '00000000-0000-0000-0000-00000000000b'$$,
  'administrador não lê dado privado de integrante');
select throws_ok(
  $$select public.admin_set_member_role('00000000-0000-0000-0000-00000000000a', 'administrador')$$,
  '42501', null, 'administrador não promove a administrador');
select throws_ok(
  $$select public.admin_set_member_role('00000000-0000-0000-0000-000000000011', 'membro')$$,
  '42501', null, 'administrador não rebaixa outro administrador');
select throws_ok(
  $$select public.admin_update_member('00000000-0000-0000-0000-00000000000f', 'ex_morador', true, 'suspended')$$,
  '42501', null, 'administrador não suspende superadmin');
select throws_ok(
  $$select public.admin_review_request('10000000-0000-0000-0000-000000000001', 'approve', 'ex_morador', false, 'administrador')$$,
  '42501', null, 'administrador não aprova solicitação já com papel de administrador');
select throws_ok(
  $$delete from public.audit_logs$$, '42501', null, 'administrador não apaga auditoria');
select throws_ok(
  $$insert into public.role_permissions (role, permission) values ('moderador', 'finance.write')$$,
  null, null, 'administrador não edita a matriz de permissões');
select lives_ok(
  $$select public.admin_set_member_role('00000000-0000-0000-0000-00000000000a', 'moderador', 'teste')$$,
  'administrador promove membro a moderador');

-- Fluxo completo: aprovar -> registrar convite -> convidado ativa.
select lives_ok(
  $$select public.admin_review_request('10000000-0000-0000-0000-000000000001', 'approve', 'ex_morador', true, 'membro')$$,
  'administrador aprova solicitação');
select lives_ok(
  $$select public.admin_register_invitation('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010')$$,
  'administrador registra o convite');
reset role;
select public.t_login('00000000-0000-0000-0000-000000000010');
select lives_ok('select public.activate_membership()', 'convidado ativa o próprio vínculo');
select results_eq(
  $$select category::text || '/' || is_founder::text || '/' || role::text from public.members
    where id = '00000000-0000-0000-0000-000000000010'$$,
  array['ex_morador/true/membro'],
  'vínculo criado com os valores definidos pelo administrador');

-- ---------------------------------------------------------------------------
-- Dono do banco: auditoria continua imutável
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
select throws_ok('update public.audit_logs set action = ''x''', '23001', null,
  'nem o dono do banco altera registros de auditoria');
select cmp_ok((select count(*)::int from public.audit_logs), '>=', 4,
  'operações administrativas geraram auditoria');

-- Guarda geral: nenhum GRANT padrão da plataforma sobrou em tabelas de public.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon' and privilege_type <> 'SELECT'),
  0, 'anônimo não tem privilégio de escrita em nível de tabela');
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')
      and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')),
  0, 'ninguém além do servidor tem TRUNCATE, REFERENCES ou TRIGGER');

select * from finish();
rollback;

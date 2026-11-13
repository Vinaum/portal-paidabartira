-- Administração de integrantes e atendimento de pedidos de dados.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin2@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'membro@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'alvo@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'super@example.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'mod@example.test'),
  ('00000000-0000-0000-0000-0000000000e1', 'suspenso@example.test');

insert into public.membership_requests (id, full_name, email, relationship, justification, policy_version, status)
values ('00000000-0000-0000-0000-0000000000f2', 'Alvo da Exclusão', 'alvo@example.test', 'ex-morador', 'Morei na casa em 2008 e 2009 e quero voltar a participar', '2026-11', 'activated');

select private.create_member('00000000-0000-0000-0000-0000000000a1', 'ex_morador', false, 'administrador', 'Admin Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a2', 'ex_morador', false, 'administrador', 'Admin Dois', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000b1', 'atual_morador', false, 'membro', 'José Álvaro Membro', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000b2', 'agregado', false, 'membro', 'Alvo da Exclusão', null, '00000000-0000-0000-0000-0000000000f2');
select private.create_member('00000000-0000-0000-0000-0000000000c1', 'ex_morador', true, 'superadmin', 'Super Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000d1', 'atual_morador', false, 'moderador', 'Moderador Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000e1', 'agregado', false, 'membro', 'Suspenso Um', null, null);
update public.members set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000e1';

insert into public.data_requests (id, member_id, kind, details) values
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b2', 'deletion', 'segredo-do-motivo'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a2', 'deletion', null),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000c1', 'deletion', null),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000b1', 'correction', 'corrigir nome');

create function public.t_login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
grant execute on function public.t_login(uuid) to authenticated;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Quem não administra não entra ------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.admin_list_members()$$, '42501', null, 'visitante não lista integrantes');
reset role;

select public.t_login('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$select * from public.admin_list_members()$$, '42501', null, 'membro comum não lista integrantes');
select throws_ok($$select * from public.admin_list_data_requests()$$, '42501', null, 'membro comum não lê pedidos de dados');
reset role;

select public.t_login('00000000-0000-0000-0000-0000000000d1');
select throws_ok($$select * from public.admin_get_member('00000000-0000-0000-0000-0000000000b1')$$, '42501', null, 'moderador não gerencia integrantes');
reset role;

-- Administrador: lista, filtros, detalhe e histórico ---------------------------------
select public.t_login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*) from public.admin_list_members())::int, 7, 'lista todos, inclusive suspensos');
select is((select count(*) from public.admin_list_members(p_status => 'suspended'))::int, 1, 'filtra por situação');
select is((select count(*) from public.admin_list_members(p_query => 'JOSE alvaro'))::int, 1, 'busca sem acento e sem maiúscula');
select is((select count(*) from public.admin_list_members(p_role => 'administrador'))::int, 2, 'filtra por papel');
select is((select login_email from public.admin_get_member('00000000-0000-0000-0000-0000000000b2')), 'alvo@example.test', 'detalhe traz o e-mail de login');
select is((select open_deletion_request from public.admin_get_member('00000000-0000-0000-0000-0000000000b2')), '00000000-0000-0000-0000-0000000000d2'::uuid, 'detalhe aponta pedido de exclusão aberto');
select lives_ok($$select public.admin_update_member('00000000-0000-0000-0000-0000000000b1', 'ex_morador', true, 'active', 'virou fundador')$$, 'admin altera categoria e fundador');
select is((select count(*) from public.admin_member_history('00000000-0000-0000-0000-0000000000b1'))::int, 3, 'histórico: ativação e as duas mudanças');
select is((select changed_by_name from public.admin_member_history('00000000-0000-0000-0000-0000000000b1') limit 1), 'Admin', 'histórico mostra quem mudou');

-- Pedidos de dados ------------------------------------------------------------------------
select throws_ok($$update public.data_requests set status = 'done'$$, '42501', null, 'atualização direta da tabela é negada');
select throws_ok($$select public.admin_resolve_data_request('00000000-0000-0000-0000-0000000000d5', 'done', '')$$, '23514', null, 'encerrar exige resposta ao titular');
select lives_ok($$select public.admin_resolve_data_request('00000000-0000-0000-0000-0000000000d5', 'done', 'Nome corrigido.')$$, 'encerra com resposta');
select throws_ok($$select public.admin_resolve_data_request('00000000-0000-0000-0000-0000000000d5', 'in_progress', null)$$, '23514', null, 'pedido encerrado não reabre');

-- Exclusão de conta ----------------------------------------------------------------------
select throws_ok($$select public.admin_begin_account_deletion('00000000-0000-0000-0000-0000000000d4')$$, '42501', null, 'conta de superadmin não é excluída');
select throws_ok($$select public.admin_begin_account_deletion('00000000-0000-0000-0000-0000000000d3')$$, '42501', null, 'administrador só é excluído por superadmin / nunca por si');
select is(public.admin_begin_account_deletion('00000000-0000-0000-0000-0000000000d2'), '00000000-0000-0000-0000-0000000000b2'::uuid, 'inicia a exclusão de um membro');
select throws_ok($$select public.admin_finish_account_deletion('00000000-0000-0000-0000-0000000000b2')$$, '23514', null, 'não conclui com a conta ainda existindo');
reset role;

select is((select count(*) from public.membership_requests where id = '00000000-0000-0000-0000-0000000000f2')::int, 0, 'solicitação de acesso (nome, e-mail) foi apagada');
select is((select count(*) from public.audit_logs where details::text like '%segredo-do-motivo%')::int, 0, 'texto livre do pedido não vai para a auditoria');

-- O servidor apaga a conta no Auth (aqui, direto) e então conclui.
delete from auth.users where id = '00000000-0000-0000-0000-0000000000b2';
select public.t_login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select public.admin_finish_account_deletion('00000000-0000-0000-0000-0000000000b2')$$, 'conclui e registra');
reset role;
select public.t_login('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$select public.admin_finish_account_deletion('00000000-0000-0000-0000-0000000000b2')$$, '42501', null, 'outra pessoa não conclui exclusão que não iniciou');
reset role;

select * from finish();
rollback;

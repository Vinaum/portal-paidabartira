-- Associação: adesão por aprovação, mensalidades, livro-caixa, transparência e documentos.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(62);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'mod@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'assoc@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'ex@example.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'comum@example.test'),
  ('00000000-0000-0000-0000-0000000000a6', 'suspenso@example.test');
select private.create_member('00000000-0000-0000-0000-0000000000a1', 'ex_morador', false, 'administrador', 'Admin Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a2', 'atual_morador', false, 'moderador', 'Moderador Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a3', 'agregado', false, 'membro', 'Associado Tres', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a4', 'ex_morador', false, 'membro', 'Ex Quatro', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a5', 'agregado', false, 'membro', 'Comum Cinco', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a6', 'agregado', false, 'membro', 'Suspenso Seis', null, null);

create function public.t_login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
grant execute on function public.t_login(uuid) to authenticated;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Visitante: nada.
set local role anon;
select throws_ok($$select * from public.association_members$$, '42501', null, 'visitante não lê associados');
select throws_ok($$select public.association_apply()$$, '42501', null, 'visitante não pede adesão');
reset role;

-- Adesão
select public.t_login('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$select public.association_apply()$$, '23514', null, 'atual morador não pede adesão');
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select lives_ok($$select public.association_apply()$$, 'agregado pede adesão');
select throws_ok($$select public.association_apply()$$, '23514', null, 'não pede adesão duas vezes');
select is((select count(*) from public.association_members)::int, 1, 'vê só o próprio pedido');
select throws_ok($$select public.association_decide('00000000-0000-0000-0000-0000000000a3', 'active')$$, '42501', null, 'o próprio pedinte não se aprova');
select public.t_login('00000000-0000-0000-0000-0000000000a4');
select is((select count(*) from public.association_members)::int, 0, 'outro integrante não vê pedidos alheios');

-- Quem ainda não é associado não vê nada da Associação.
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*) from public.association_summary())::int, 0, 'pendente não vê o resumo');
select is((select count(*) from public.association_get_settings())::int, 0, 'pendente não vê o PIX');
select throws_ok($$select public.association_inform_due(current_date, 5000)$$, '42501', null, 'pendente não informa mensalidade');

-- Moderador sem a permissão não decide; com ela, decide.
select public.t_login('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$select public.association_decide('00000000-0000-0000-0000-0000000000a3', 'active')$$, '42501', null, 'moderador sem permissão não decide');
select throws_ok($$select * from public.association_list_members()$$, '42501', null, 'moderador sem permissão não lista associados');
reset role;
insert into public.role_permissions (role, permission) values ('moderador', 'association.manage');
select public.t_login('00000000-0000-0000-0000-0000000000a2');
select is((select count(*) from public.association_list_members())::int, 1, 'moderador com a permissão lista associados');
delete from public.role_permissions where role = 'moderador' and permission = 'association.manage';
reset role;

-- Administração aprova.
select public.t_login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select public.association_decide('00000000-0000-0000-0000-0000000000a3', 'left')$$, '23514', null, 'pendente não "sai"');
select lives_ok($$select public.association_decide('00000000-0000-0000-0000-0000000000a3', 'active')$$, 'administrador aprova');
select is((select joined_on from public.association_members where member_id = '00000000-0000-0000-0000-0000000000a3'), (now() at time zone 'America/Sao_Paulo')::date, 'registra a data de entrada');
select throws_ok($$select public.association_decide('00000000-0000-0000-0000-0000000000a3', 'active')$$, '23514', null, 'não aprova quem já é associado');

-- Configuração do PIX
select lives_ok($$select public.association_save_settings('chave-pix-secreta-123', 'Associação X', 'Use o CPF', 5000)$$, 'gestão salva o PIX');
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select is((select pix_key from public.association_get_settings()), 'chave-pix-secreta-123', 'associado lê o PIX');
select throws_ok($$select public.association_save_settings('x', 'y', 'z', 1)$$, '42501', null, 'associado não altera o PIX');
select throws_ok($$select pix_key from public.association_settings$$, '42501', null, 'tabela de configuração não é legível direto');
select public.t_login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*) from public.association_get_settings())::int, 0, 'integrante comum não lê o PIX');

-- Mensalidades
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select lives_ok($$select public.association_inform_due(current_date, 5000)$$, 'associado informa o mês atual');
select throws_ok($$select public.association_inform_due(current_date, 5000)$$, '23514', null, 'não informa o mesmo mês duas vezes');
select throws_ok($$select public.association_inform_due((current_date + interval '2 months')::date, 5000)$$, '23514', null, 'não informa mês futuro');
select throws_ok($$select public.association_inform_due((current_date - interval '1 month')::date, 0)$$, '23514', null, 'valor zero é recusado');
select is((select count(*) from public.association_dues)::int, 1, 'associado vê as próprias mensalidades');
select public.t_login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*) from public.association_dues)::int, 0, 'outro integrante não vê mensalidades alheias');
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$select public.association_decide_due((select id from public.association_dues limit 1), true)$$, '42501', null, 'associado não confirma a própria mensalidade');

select public.t_login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*) from public.association_list_dues('informed'))::int, 1, 'gestão vê a mensalidade informada');
select lives_ok($$select public.association_decide_due((select id from public.association_dues limit 1), true)$$, 'gestão confirma');
select throws_ok($$select public.association_decide_due((select id from public.association_dues limit 1), true)$$, '23514', null, 'não confirma duas vezes');
select is((select count(*) from public.association_ledger where kind = 'income' and amount_cents = 5000 and description not like '%Associado%')::int, 1, 'entrada no livro-caixa sem o nome de quem pagou');

-- Transparência
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select is((select raised_cents from public.association_summary()), 5000::bigint, 'associado vê o total arrecadado');
select is((select count(*) from public.association_ledger)::int, 0, 'associado não lê o livro-caixa direto');
select is((select count(*) from public.association_cashflow())::int, 1, 'associado vê o fluxo por mês');

-- Livro-caixa
select public.t_login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select public.association_add_entry('expense', 1500, current_date, 'Limpeza', 'Faxina da casa')$$, 'gestão lança saída');
select throws_ok($$select public.association_add_entry('expense', 999999, current_date, 'Obra', 'Reforma')$$, '23514', null, 'saldo não fica negativo');
select throws_ok($$select public.association_add_entry('expense', 100, (current_date + 3), 'Obra', 'Data futura')$$, '23514', null, 'data futura é recusada');
select lives_ok($$select public.association_reverse_entry((select id from public.association_ledger where kind = 'expense' and reverses_id is null limit 1), 'Lançado por engano')$$, 'gestão estorna');
select throws_ok($$select public.association_reverse_entry((select id from public.association_ledger where reverses_id is not null limit 1), 'de novo')$$, '23514', null, 'não estorna um estorno');
select is((select spent_cents from public.association_summary()), 0::bigint, 'estorno zera a saída');
select throws_ok($$delete from public.association_ledger$$, '42501', null, 'ninguém apaga o livro-caixa pela API');
reset role;
select throws_ok($$update public.association_ledger set amount_cents = 1$$, '23001', null, 'livro-caixa é imutável até para o banco');
select throws_ok($$delete from public.association_ledger$$, '23001', null, 'livro-caixa não é apagado');

-- Estornar a entrada de uma mensalidade libera o mês para novo informe.
select public.t_login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select public.association_reverse_entry((select ledger_entry_id from public.association_dues limit 1), 'Pagamento não identificado')$$, 'estorna a entrada da mensalidade');
select is((select status::text from public.association_dues limit 1), 'rejected', 'mensalidade volta a recusada');
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select lives_ok($$select public.association_inform_due(current_date, 5000)$$, 'associado pode informar o mês de novo');
select public.t_login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select public.association_decide_due((select id from public.association_dues where status = 'informed'), false)$$, 'gestão recusa');
select is((select count(*) from public.association_ledger where kind = 'income' and reverses_id is null)::int, 1, 'recusa não lança no livro-caixa');

-- Documentos
select lives_ok($$select public.association_add_document('ata', 'Ata da assembleia', null, current_date, 'docs/ata-1.pdf', 1000)$$, 'gestão publica documento');
select throws_ok($$select public.association_add_document('ata', 'Ata ruim', null, current_date, '../etc/passwd', 1000)$$, '23514', null, 'caminho inválido é recusado');
select throws_ok($$select public.association_add_document('ata', 'Grande demais', null, current_date, 'docs/g.pdf', 9000000)$$, '23514', null, 'arquivo acima de 8 MB é recusado');
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*) from public.association_documents)::int, 1, 'associado lê documentos');
select throws_ok($$select public.association_add_document('ata', 'Intruso', null, current_date, 'docs/i.pdf', 10)$$, '42501', null, 'associado não publica documento');
select public.t_login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*) from public.association_documents)::int, 0, 'integrante comum não lê documentos');
select public.t_login('00000000-0000-0000-0000-0000000000a1');
select is((select public.association_remove_document((select id from public.association_documents limit 1))), 'docs/ata-1.pdf', 'remoção devolve o caminho do arquivo');

-- Saída e suspensão cortam o acesso na hora.
select lives_ok($$select public.association_decide('00000000-0000-0000-0000-0000000000a3', 'left')$$, 'gestão registra a saída');
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*) from public.association_summary())::int, 0, 'quem saiu não vê mais o resumo');
reset role;
update public.association_members set status = 'active' where member_id = '00000000-0000-0000-0000-0000000000a3';
update public.members set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000a3';
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*) from public.association_summary())::int, 0, 'associado suspenso não vê o resumo');
reset role;

-- Auditoria sem a chave PIX.
select is((select count(*) from public.audit_logs where details::text like '%chave-pix-secreta%')::int, 0, 'auditoria não guarda a chave PIX');

select * from finish();
rollback;

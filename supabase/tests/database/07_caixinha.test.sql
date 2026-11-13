-- Caixinha: totais sem doadores, livro-caixa imutável, responsáveis por caixinha.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(40);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'resp@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'membro@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'mod@example.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'suspenso@example.test'),
  ('00000000-0000-0000-0000-0000000000a6', 'apagar@example.test');
select private.create_member('00000000-0000-0000-0000-0000000000a1', 'ex_morador', false, 'administrador', 'Admin Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a2', 'atual_morador', false, 'membro', 'Responsável Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a3', 'agregado', false, 'membro', 'Membro Comum', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a4', 'atual_morador', false, 'moderador', 'Moderador Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a5', 'agregado', false, 'membro', 'Suspenso Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a6', 'agregado', false, 'membro', 'Apagar Um', null, null);
update public.members set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000a5';

insert into public.funds (id, name, visibility, is_active, goal_cents, pix_key) values
  ('00000000-0000-0000-0000-0000000000f1', 'Caixinha da casa', 'public', true, 5000000, 'chave-pix-secreta'),
  ('00000000-0000-0000-0000-0000000000f2', 'Fundo interno', 'members', true, null, null),
  ('00000000-0000-0000-0000-0000000000f3', 'Caixinha antiga', 'public', false, null, 'chave-antiga');
insert into public.fund_managers (fund_id, member_id) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a2');

-- F1: duas entradas (uma em mês anterior), uma saída; F2: uma entrada.
insert into public.ledger_entries (id, fund_id, kind, amount_cents, occurred_on, category, description, created_by) values
  ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-0000000000f1', 'income',  100000, current_date - 40, null, 'Contribuições do mês anterior', '00000000-0000-0000-0000-0000000000a6'),
  ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-0000000000f1', 'income',   50050, current_date - 5,  null, 'Contribuições (PIX)', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000e003', '00000000-0000-0000-0000-0000000000f1', 'expense',  30000, current_date - 3,  'contas', 'Conta de luz', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000e004', '00000000-0000-0000-0000-0000000000f2', 'income',   20000, current_date - 2,  null, 'Aporte', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000e005', '00000000-0000-0000-0000-0000000000f2', 'expense',  15000, current_date - 1,  'compras', 'Compra', '00000000-0000-0000-0000-0000000000a1');

create function public.t_login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
grant execute on function public.t_login(uuid) to authenticated;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Visitante ------------------------------------------------------------------------------
set local role anon;
select is((select count(*) from public.fund_overview())::int, 1, 'visitante vê só caixinha pública e ativa');
select is((select raised_cents from public.fund_overview()), 150050::bigint, 'visitante vê o total arrecadado');
select is((select spent_cents from public.fund_overview()), null, 'visitante não vê gasto');
select is((select balance_cents from public.fund_overview()), null, 'visitante não vê saldo');
select is((select pix_key from public.fund_overview()), 'chave-pix-secreta', 'visitante vê a chave PIX da caixinha pública ativa');
select throws_ok($$select * from public.ledger_entries$$, '42501', null, 'visitante não lê o livro-caixa');
select throws_ok($$select * from public.fund_cashflow('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'visitante não vê fluxo de caixa');
reset role;

-- Integrante comum ---------------------------------------------------------------------------
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*) from public.fund_overview())::int, 3, 'integrante vê as caixinhas públicas, de integrantes e encerradas');
select is((select balance_cents from public.fund_overview() where id = '00000000-0000-0000-0000-0000000000f1'), 120050::bigint, 'integrante vê saldo (entradas - saídas)');
select is((select pix_key from public.fund_overview() where id = '00000000-0000-0000-0000-0000000000f3'), null, 'caixinha encerrada não mostra PIX');
select is((select count(*) from public.ledger_entries)::int, 0, 'integrante não lê lançamentos individuais');
select is((select count(*) from public.funds)::int, 0, 'integrante não lê a tabela de caixinhas (chave PIX)');
select is((select count(*) from public.fund_cashflow('00000000-0000-0000-0000-0000000000f1'))::int, 2, 'fluxo de caixa por mês');
select is((select income_cents from public.fund_cashflow('00000000-0000-0000-0000-0000000000f1') order by month desc limit 1), 50050::bigint, 'entrada do mês corrente agregada');
select is((select count(*) from public.fund_expenses('00000000-0000-0000-0000-0000000000f1'))::int, 1, 'integrante vê as saídas, uma a uma');
select is((select description from public.fund_expenses('00000000-0000-0000-0000-0000000000f1')), 'Conta de luz', 'com descrição');
select throws_ok($$select public.finance_add_entry('00000000-0000-0000-0000-0000000000f1', 'income', 100, current_date, null, 'tentativa')$$, '42501', null, 'integrante não lança');
select throws_ok($$select public.finance_set_fund_manager('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a3', true)$$, '42501', null, 'integrante não se designa responsável');
reset role;

select public.t_login('00000000-0000-0000-0000-0000000000a4');
select throws_ok($$select public.finance_add_entry('00000000-0000-0000-0000-0000000000f1', 'income', 100, current_date, null, 'tentativa')$$, '42501', null, 'moderador não lança');
reset role;

select public.t_login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*) from public.fund_overview())::int, 1, 'suspenso vê só o que o público vê');
reset role;

-- Responsável pela caixinha F1 ---------------------------------------------------------------
select public.t_login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$select public.finance_add_entry('00000000-0000-0000-0000-0000000000f1', 'expense', 1050, current_date, 'compras', 'Material de limpeza')$$, 'responsável lança na sua caixinha');
select throws_ok($$select public.finance_add_entry('00000000-0000-0000-0000-0000000000f2', 'income', 100, current_date, null, 'outra caixinha')$$, '42501', null, 'responsável não lança em outra caixinha');
select is((select count(*) from public.ledger_entries)::int, 4, 'responsável lê os lançamentos da sua caixinha (3 + o novo)');
select throws_ok($$select public.finance_set_fund_manager('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a3', true)$$, '42501', null, 'responsável não designa outros');
select throws_ok($$insert into public.ledger_entries (fund_id, kind, amount_cents, occurred_on, description) values ('00000000-0000-0000-0000-0000000000f1', 'income', 100, current_date, 'direto')$$, '42501', null, 'ninguém insere direto no livro-caixa');
reset role;

-- Administrador ---------------------------------------------------------------------------------
select public.t_login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$select public.finance_add_entry('00000000-0000-0000-0000-0000000000f1', 'expense', 99999999, current_date, 'contas', 'Maior que o saldo')$$, '23514', null, 'saída maior que o saldo é recusada');
select throws_ok($$select public.finance_add_entry('00000000-0000-0000-0000-0000000000f1', 'income', 100, current_date + 1, null, 'Amanhã')$$, '23514', null, 'data futura é recusada');
select throws_ok($$select public.finance_add_entry('00000000-0000-0000-0000-0000000000f1', 'income', 0, current_date, null, 'Zero')$$, '23514', null, 'valor zero é recusado');
select throws_ok($$select public.finance_add_entry('00000000-0000-0000-0000-0000000000f3', 'income', 100, current_date, null, 'Encerrada')$$, '23514', null, 'caixinha encerrada não recebe lançamento');
select lives_ok($$select public.finance_reverse_entry('00000000-0000-0000-0000-00000000e003', 'Conta lançada em duplicidade')$$, 'estorna uma saída');
select is((select balance_cents from public.fund_overview() where id = '00000000-0000-0000-0000-0000000000f1'), 149000::bigint, 'o estorno devolve o valor ao saldo (e a saída do responsável permanece)');
select throws_ok($$select public.finance_reverse_entry('00000000-0000-0000-0000-00000000e003', 'De novo')$$, '23505', null, 'não se estorna duas vezes');
select throws_ok($$select public.finance_reverse_entry('00000000-0000-0000-0000-00000000e004', 'Entrada já gasta')$$, '23514', null, 'estorno que deixaria saldo negativo é recusado');
select lives_ok($$select public.finance_set_fund_manager('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a3', true)$$, 'administrador designa responsável');
select throws_ok($$select public.finance_set_fund_manager('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a5', true)$$, '23514', null, 'suspenso não vira responsável');
reset role;

-- Imutabilidade e auditoria (como dono do banco) ------------------------------------------------------
select throws_ok($$update public.ledger_entries set amount_cents = 1 where id = '00000000-0000-0000-0000-00000000e001'$$, '23001', null, 'lançamento não se altera');
select throws_ok($$delete from public.ledger_entries where id = '00000000-0000-0000-0000-00000000e001'$$, '23001', null, 'lançamento não se apaga');
select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-0000000000a6'$$, 'excluir a conta (LGPD) não é barrado pelo livro-caixa');
select is((select created_by from public.ledger_entries where id = '00000000-0000-0000-0000-00000000e001'), null, 'só o autor do lançamento é desvinculado');
select is((select count(*) from public.audit_logs where details::text like '%chave-pix-secreta%')::int, 0, 'a chave PIX não vai para a auditoria');

select * from finish();
rollback;

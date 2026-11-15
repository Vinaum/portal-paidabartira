-- Vagas para novos moradores: leitura pública só das abertas, interesses só para a gestão.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(33);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'mod@example.test'),
  ('00000000-0000-0000-0000-0000000000b3', 'membro@example.test');
select private.create_member('00000000-0000-0000-0000-0000000000b1', 'ex_morador', false, 'administrador', 'Admin Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000b2', 'atual_morador', false, 'moderador', 'Moderador Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000b3', 'atual_morador', false, 'membro', 'Membro Tres', null, null);

create function public.t_login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
grant execute on function public.t_login(uuid) to authenticated;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Gestão cria vagas.
select public.t_login('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$select public.vacancy_save(null, 'Quarto individual', 'Quarto com janela, perto do bloco.', 85000, current_date)$$, 'administrador cria vaga');
select throws_ok($$select public.vacancy_save(null, 'ab', 'Descrição suficiente', null, null)$$, '23514', null, 'título curto é recusado');
select throws_ok($$select public.vacancy_save(null, 'Vaga zero', 'Descrição suficiente', 0, null)$$, '23514', null, 'valor zero é recusado');
select lives_ok($$select public.vacancy_save(null, 'Vaga antiga', 'Já preenchida por alguém.', null, null)$$, 'cria segunda vaga');
select lives_ok($$select public.vacancy_set_status((select id from public.vacancies where title = 'Vaga antiga'), 'closed')$$, 'encerra a segunda vaga');
select lives_ok($$select public.vacancy_save((select id from public.vacancies where title = 'Quarto individual'), 'Quarto individual', 'Quarto com janela e armário.', 90000, null)$$, 'edita a vaga');
select is((select monthly_cents from public.vacancies where title = 'Quarto individual'), 90000::bigint, 'edição gravada');
select is((select count(*) from public.vacancies)::int, 2, 'gestão vê abertas e encerradas');
reset role;

-- Visitante: só abertas; sem acesso a interesses nem às funções de gestão.
set local role anon;
select is((select count(*) from public.vacancies)::int, 1, 'visitante vê só a vaga aberta');
select throws_ok($$select * from public.vacancy_interests$$, '42501', null, 'visitante não lê interesses');
select throws_ok($$select public.vacancy_save(null, 'Invasão', 'Descrição suficiente', null, null)$$, '42501', null, 'visitante não cria vaga');
select throws_ok($$select public.vacancy_delete_interest(gen_random_uuid())$$, '42501', null, 'visitante não apaga interesse');
select throws_ok($$select public.vacancy_purge_old_interests()$$, '42501', null, 'visitante não executa a limpeza');

-- Interesse de candidato (sem login).
select is((select public.vacancy_express_interest((select id from public.vacancies limit 1), 'Maria Candidata', 'Maria@Exemplo.com', '19 99999-0000', 'Engenharia', 'Tenho interesse.', '2026-11-15.2')), 'ok', 'visitante demonstra interesse');
select is((select public.vacancy_express_interest((select id from public.vacancies limit 1), 'Maria Candidata', 'maria@exemplo.com', null, null, null, '2026-11-15.2')), 'ok', 'repetir o e-mail responde igual');
select throws_ok($$select public.vacancy_express_interest((select id from public.vacancies limit 1), 'João Candidato', 'joao@exemplo.com', null, null, null, '1999-01-01')$$, '23514', null, 'versão de política inválida é recusada');
select throws_ok($$select public.vacancy_express_interest((select id from public.vacancies limit 1), 'João Candidato', 'sem-arroba', null, null, null, '2026-11-15.2')$$, '23514', null, 'e-mail inválido é recusado');
reset role;
select is((select count(*) from public.vacancy_interests)::int, 1, 'e-mail repetido não duplica o interesse');
select is((select email from public.vacancy_interests), 'maria@exemplo.com', 'e-mail é normalizado');

select is((select public.vacancy_express_interest((select id from public.vacancies where status = 'closed'), 'Zé Fechado', 'ze@exemplo.com', null, null, null, '2026-11-15.2')), 'closed', 'vaga encerrada não recebe interesse');

-- Limite por hora.
insert into public.vacancy_interests (vacancy_id, name, email, policy_version)
select (select id from public.vacancies where status = 'open'), 'Candidato ' || g, 'c' || g || '@exemplo.com', '2026-11-15.2'
from generate_series(1, 29) g;
select is((select public.vacancy_express_interest((select id from public.vacancies where status = 'open'), 'Mais Um', 'maisum@exemplo.com', null, null, null, '2026-11-15.2')), 'throttled', 'limite de envios por hora');
delete from public.vacancy_interests where email like 'c%@exemplo.com';

-- Quem não gerencia não vê nada; moderador com a permissão vê.
select public.t_login('00000000-0000-0000-0000-0000000000b3');
select is((select count(*) from public.vacancy_interests)::int, 0, 'integrante comum não lê interesses');
select is((select count(*) from public.vacancies)::int, 1, 'integrante comum vê só vaga aberta');
select throws_ok($$select public.vacancy_set_status((select id from public.vacancies limit 1), 'closed')$$, '42501', null, 'integrante comum não encerra vaga');
select public.t_login('00000000-0000-0000-0000-0000000000b2');
select is((select count(*) from public.vacancy_interests)::int, 0, 'moderador sem permissão não lê interesses');
reset role;
insert into public.role_permissions (role, permission) values ('moderador', 'vacancies.manage');
select public.t_login('00000000-0000-0000-0000-0000000000b2');
select is((select count(*) from public.vacancy_interests)::int, 1, 'moderador com a permissão lê interesses');
reset role;
delete from public.role_permissions where role = 'moderador' and permission = 'vacancies.manage';

-- Gestão trata interesses e retenção.
select public.t_login('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$select public.vacancy_set_interest_status((select id from public.vacancy_interests limit 1), 'contacted')$$, 'marca como contatado');
reset role;
insert into public.vacancy_interests (vacancy_id, name, email, policy_version, created_at)
values ((select id from public.vacancies where status = 'open'), 'Antigo Candidato', 'antigo@exemplo.com', '2026-11-15.2', now() - interval '100 days');
select public.t_login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*) from public.vacancy_interests where email = 'antigo@exemplo.com')::int, 0, 'interesse com mais de 90 dias já não é visível');
select is((select public.vacancy_purge_old_interests()), 1, 'limpeza apaga interesse com mais de 90 dias');
select lives_ok($$select public.vacancy_delete_interest((select id from public.vacancy_interests limit 1))$$, 'gestão apaga um interesse');
reset role;
insert into public.vacancy_interests (vacancy_id, name, email, policy_version)
values ((select id from public.vacancies where status = 'open'), 'Para Cascata', 'cascata@exemplo.com', '2026-11-15.2');
select public.t_login('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$select public.vacancy_delete((select id from public.vacancies where status = 'open'))$$, 'gestão apaga a vaga');
reset role;
select is((select count(*) from public.vacancy_interests)::int, 0, 'apagar a vaga apaga os interesses');

-- Auditoria sem dados pessoais.
select is((select count(*) from public.audit_logs where action like 'vacancy.%' and details::text like '%@%')::int, 0, 'auditoria não guarda e-mail');

select * from finish();
rollback;

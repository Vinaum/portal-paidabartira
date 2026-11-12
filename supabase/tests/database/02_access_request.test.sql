-- Solicitação de acesso: o visitante só entra pela função, sem escolher
-- papel, sem descobrir quem já pediu acesso e com consentimento registrado.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(11);

grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  public.submit_membership_request(
    '  Fulana de Tal ', 'Fulana@Example.TEST', 'Ex-moradora', 'Morei na casa entre 2009 e 2012.', '2026-11',
    'Fu', null, null),
  'ok', 'visitante envia solicitação pela função');
select is(
  public.submit_membership_request(
    'Outra Pessoa', 'fulana@example.test', 'Agregada', 'Tentando de novo com o mesmo e-mail.', '2026-11'),
  'ok', 'e-mail repetido recebe a mesma resposta (não revela solicitação existente)');
select throws_ok(
  $$select public.submit_membership_request('Fulano', 'f@example.test', 'Agregado', 'Justificativa válida aqui.', '1999-01')$$,
  '23514', null, 'versão de política inexistente é recusada');
select throws_ok(
  $$select public.submit_membership_request('Fulano', 'nao-e-email', 'Agregado', 'Justificativa válida aqui.', '2026-11')$$,
  '23514', null, 'e-mail inválido é recusado pelo banco');
select throws_ok(
  $$select public.submit_membership_request('Fulano', 'curta@example.test', 'Agregado', 'curta', '2026-11')$$,
  '23514', null, 'justificativa curta demais é recusada pelo banco');
select throws_ok('select * from public.membership_requests', '42501', null,
  'visitante não lê o que enviou nem o que outros enviaram');

reset role;
select is(
  (select count(*)::int from public.membership_requests where email = 'fulana@example.test'),
  1, 'e-mail repetido não cria segunda solicitação');
select results_eq(
  $$select full_name, nickname, status::text, assigned_role::text, assigned_is_founder
      from public.membership_requests where email = 'fulana@example.test'$$,
  $$values ('Fulana de Tal', 'Fu', 'pending', 'membro', false)$$,
  'solicitação nasce pendente, normalizada, sem papel nem fundador');
select is(
  (select count(*)::int from public.consents c
     join public.membership_requests r on r.id = c.request_id
    where r.email = 'fulana@example.test' and c.context = 'access_request' and c.policy_version = '2026-11'),
  1, 'consentimento registrado com a versão da política');

-- Limite de volume: com 20 envios na última hora, o próximo é contido.
insert into public.membership_requests (full_name, email, relationship, justification, policy_version)
select 'Carga ' || i, 'carga' || i || '@example.test', 'Agregado', 'Solicitação de carga para o teste.', '2026-11'
from generate_series(1, 19) as i;

set local role anon;
select is(
  public.submit_membership_request('Vigésima Primeira', 'extra@example.test', 'Agregado', 'Deveria ser contida pelo limite.', '2026-11'),
  'throttled', 'envios acima do limite por hora são contidos');
reset role;
select is(
  (select count(*)::int from public.membership_requests where email = 'extra@example.test'),
  0, 'envio contido não grava nada');

select * from finish();
rollback;

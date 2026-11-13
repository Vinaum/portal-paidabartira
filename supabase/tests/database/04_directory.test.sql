-- Diretório: a busca respeita a privacidade de cada seção e não deixa filtrar
-- por dado que o dono escondeu.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'suspenso@example.test');
select private.create_member('00000000-0000-0000-0000-0000000000a1', 'ex_morador', true, 'membro', 'José Álvaro da Silva', 'Zeca', null);
select private.create_member('00000000-0000-0000-0000-0000000000b1', 'atual_morador', false, 'membro', 'Beatriz Souza', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000c1', 'agregado', false, 'membro', 'Suspenso Pereira', null, null);
update public.members set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000c1';

update public.profiles set current_city = 'São Paulo', current_country = 'Brasil'
  where member_id = '00000000-0000-0000-0000-0000000000a1';
insert into public.profile_professional (member_id, company, job_title, field)
  values ('00000000-0000-0000-0000-0000000000a1', 'Acme Ltda', 'Engenheiro de software', 'Tecnologia');
insert into public.education (member_id, course, institution, start_year, end_year)
  values ('00000000-0000-0000-0000-0000000000a1', 'Engenharia de Computação', 'UNICAMP', 2006, 2011);
insert into public.residency_periods (member_id, started_on, ended_on) values
  ('00000000-0000-0000-0000-0000000000a1', date '2007-03-01', date '2010-07-01'),
  ('00000000-0000-0000-0000-0000000000a1', date '2011-05-01', date '2011-12-01');
insert into public.profile_photo (member_id, media_path)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1/avatar/foto.jpg');
update public.profile_privacy set visibility = 'members'
  where member_id = '00000000-0000-0000-0000-0000000000a1' and section in ('professional', 'academic', 'photo');

create function public.t_login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
grant execute on function public.t_login(uuid) to authenticated;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Visitante e suspenso ------------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.search_directory()$$, '42501', null, 'visitante não executa a busca');
reset role;

select public.t_login('00000000-0000-0000-0000-0000000000c1');
select is((select count(*) from public.search_directory())::int, 0, 'integrante suspenso não vê o diretório');
reset role;

-- Integrante ativo ----------------------------------------------------------------
select public.t_login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*) from public.search_directory())::int, 2, 'lista só integrantes ativos');
select is((select display_name from public.search_directory(p_query => 'JOSE alvaro')), 'Zeca', 'nome casa sem acento e sem maiúscula');
select is((select count(*) from public.search_directory(p_query => 'zeca'))::int, 1, 'apelido também casa');
select is((select count(*) from public.search_directory(p_query => '%'))::int, 0, 'curinga % é tratado como texto');
select is((select count(*) from public.search_directory(p_query => '_'))::int, 0, 'curinga _ é tratado como texto');
select is((select count(*) from public.search_directory(p_founders_only => true))::int, 1, 'filtra fundadores');
select is((select count(*) from public.search_directory(p_category => 'atual_morador'))::int, 1, 'filtra categoria');
select is((select count(*) from public.search_directory(p_resident_year => 2009))::int, 1, 'quem morava em 2009');
select is((select count(*) from public.search_directory(p_resident_year => 2011))::int, 1, 'segundo período conta (2011)');
select is((select count(*) from public.search_directory(p_resident_year => 2010))::int, 1, 'ano de saída conta (2010)');
select is((select count(*) from public.search_directory(p_resident_year => 2012))::int, 0, 'ninguém morava em 2012');
select is((select count(*) from public.search_directory(p_course => 'computacao', p_graduation_year => 2011))::int, 1, 'curso e ano de formatura');
select is((select count(*) from public.search_directory(p_company => 'acme'))::int, 1, 'empresa visível a membros pode ser filtrada');

-- A esconde a seção profissional e a foto: nada disso vaza, nem por filtro ------------
select public.t_login('00000000-0000-0000-0000-0000000000a1');
update public.profile_privacy set visibility = 'private'
  where member_id = '00000000-0000-0000-0000-0000000000a1' and section in ('professional', 'photo');
reset role;

select public.t_login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*) from public.search_directory(p_company => 'acme'))::int, 0, 'empresa privada não casa com filtro');
select is(
  (select company || coalesce(job_title, '') || coalesce(photo_path, '') from public.search_directory(p_query => 'zeca')),
  null, 'empresa, cargo e foto privados voltam nulos');
reset role;

-- Pedido de exclusão: um em aberto por vez, e só em nome próprio ---------------------
select public.t_login('00000000-0000-0000-0000-0000000000b1');
select lives_ok(
  $$insert into public.data_requests (member_id, kind, details) values ('00000000-0000-0000-0000-0000000000b1', 'deletion', 'quero sair')$$,
  'integrante pede a exclusão da própria conta');
select throws_ok(
  $$insert into public.data_requests (member_id, kind) values ('00000000-0000-0000-0000-0000000000b1', 'deletion')$$,
  '23505', null, 'segundo pedido em aberto é recusado');
select throws_ok(
  $$insert into public.data_requests (member_id, kind) values ('00000000-0000-0000-0000-0000000000a1', 'deletion')$$,
  '42501', null, 'ninguém abre pedido em nome de outra pessoa');
reset role;

select * from finish();
rollback;

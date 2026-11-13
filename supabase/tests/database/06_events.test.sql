-- Eventos: quem vê, quem escreve e quem confirma presença.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(27);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'membro@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'outro@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'mod@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'suspenso@example.test');
select private.create_member('00000000-0000-0000-0000-0000000000a1', 'atual_morador', false, 'membro', 'Ana Membro', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a2', 'ex_morador', false, 'membro', 'Beto Outro', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000b1', 'atual_morador', false, 'moderador', 'Moderador Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000c1', 'agregado', false, 'membro', 'Suspenso Um', null, null);
update public.members set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000c1';

insert into public.events (id, title, starts_at, ends_at, visibility, status) values
  ('00000000-0000-0000-0000-0000000000e1', 'Churrasco aberto', now() + interval '7 days', null, 'public', 'published'),
  ('00000000-0000-0000-0000-0000000000e2', 'Reunião interna', now() + interval '8 days', null, 'members', 'published'),
  ('00000000-0000-0000-0000-0000000000e3', 'Rascunho', now() + interval '9 days', null, 'public', 'draft'),
  ('00000000-0000-0000-0000-0000000000e4', 'Festa cancelada', now() + interval '10 days', null, 'public', 'cancelled'),
  ('00000000-0000-0000-0000-0000000000e5', 'Encontro passado', now() - interval '30 days', now() - interval '29 days', 'members', 'published');

create function public.t_login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
grant execute on function public.t_login(uuid) to authenticated;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Visitante ----------------------------------------------------------------------------
set local role anon;
select is((select count(*) from public.events)::int, 2, 'visitante vê só evento público publicado ou cancelado');
select is((select count(*) from public.events where title = 'Rascunho')::int, 0, 'visitante não vê rascunho');
select throws_ok($$select created_by from public.events$$, '42501', null, 'visitante não lê quem criou o evento');
select throws_ok($$select * from public.event_attendees('00000000-0000-0000-0000-0000000000e1')$$, '42501', null, 'visitante não vê quem vai');
reset role;

-- Integrante ---------------------------------------------------------------------------
select public.t_login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*) from public.events)::int, 4, 'integrante vê publicados e cancelados, não rascunho');
select throws_ok($$insert into public.events (title, starts_at, created_by) values ('Meu evento', now() + interval '1 day', '00000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'integrante comum não cria evento');
update public.events set title = 'Hackeado' where id = '00000000-0000-0000-0000-0000000000e1';
select is((select title from public.events where id = '00000000-0000-0000-0000-0000000000e1'), 'Churrasco aberto', 'integrante comum não edita evento');

select lives_ok($$insert into public.event_rsvps (event_id, member_id, answer, guests) values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a1', 'going', 2)$$, 'confirma presença em evento publicado');
select throws_ok($$insert into public.event_rsvps (event_id, member_id, answer) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a2', 'going')$$, '42501', null, 'não confirma em nome de outra pessoa');
select throws_ok($$insert into public.event_rsvps (event_id, member_id, answer) values ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000a1', 'going')$$, '42501', null, 'não confirma em evento cancelado');
select throws_ok($$insert into public.event_rsvps (event_id, member_id, answer) values ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000a1', 'going')$$, '42501', null, 'não confirma em evento que já terminou');
select throws_ok($$insert into public.event_rsvps (event_id, member_id, answer) values ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a1', 'going')$$, '42501', null, 'não confirma em rascunho');
select throws_ok($$insert into public.event_rsvps (event_id, member_id, answer, guests) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'going', 11)$$, '23514', null, 'limite de acompanhantes');
select lives_ok($$update public.event_rsvps set answer = 'maybe', guests = 0 where event_id = '00000000-0000-0000-0000-0000000000e2'$$, 'muda a própria resposta');
select is((select answer::text from public.event_rsvps where event_id = '00000000-0000-0000-0000-0000000000e2'), 'maybe', 'resposta atualizada');
reset role;

select public.t_login('00000000-0000-0000-0000-0000000000a2');
select is((select display_name from public.event_attendees('00000000-0000-0000-0000-0000000000e2')), 'Ana', 'outro integrante vê quem confirmou');
select is((select count(*) from public.event_rsvps)::int, 1, 'e vê as respostas do evento');
update public.event_rsvps set answer = 'not_going' where event_id = '00000000-0000-0000-0000-0000000000e2';
reset role;
select is((select answer::text from public.event_rsvps), 'maybe', 'ninguém altera a resposta de outra pessoa');

-- Suspenso -------------------------------------------------------------------------------
select public.t_login('00000000-0000-0000-0000-0000000000c1');
select is((select count(*) from public.events)::int, 0, 'suspenso não vê eventos de integrantes');
select is((select count(*) from public.event_attendees('00000000-0000-0000-0000-0000000000e2'))::int, 0, 'suspenso não vê quem vai');
reset role;

-- Moderador (events.manage) ---------------------------------------------------------------
select public.t_login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*) from public.events)::int, 5, 'moderador vê também os rascunhos');
select lives_ok($$insert into public.events (title, starts_at, created_by) values ('Novo evento', now() + interval '3 days', '00000000-0000-0000-0000-0000000000b1')$$, 'moderador cria evento');
select throws_ok($$insert into public.events (title, starts_at, created_by) values ('Em nome de outro', now() + interval '3 days', '00000000-0000-0000-0000-0000000000a1')$$, '42501', null, 'moderador não cria em nome de outra pessoa');
select throws_ok($$insert into public.events (title, starts_at, ends_at, created_by) values ('Fim antes do início', now() + interval '3 days', now() + interval '2 days', '00000000-0000-0000-0000-0000000000b1')$$, '23514', null, 'fim não pode ser antes do início');
select lives_ok($$update public.events set status = 'cancelled' where id = '00000000-0000-0000-0000-0000000000e2'$$, 'moderador cancela evento');
delete from public.events where id = '00000000-0000-0000-0000-0000000000e1';
select is((select count(*) from public.events where id = '00000000-0000-0000-0000-0000000000e1')::int, 1, 'evento publicado não se apaga');
delete from public.events where id = '00000000-0000-0000-0000-0000000000e3';
select is((select count(*) from public.events where id = '00000000-0000-0000-0000-0000000000e3')::int, 0, 'rascunho se apaga');
reset role;

select * from finish();
rollback;

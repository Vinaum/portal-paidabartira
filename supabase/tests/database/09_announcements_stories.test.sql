-- Comunicados e histórias: visibilidade, autoria, moderação e comentários.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(29);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'mod@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'membro@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'outro@example.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'suspenso@example.test');
select private.create_member('00000000-0000-0000-0000-0000000000a1', 'ex_morador', false, 'administrador', 'Admin Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a2', 'atual_morador', false, 'moderador', 'Moderador Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a3', 'agregado', false, 'membro', 'Membro Comum', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a4', 'agregado', false, 'membro', 'Outro Membro', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a5', 'agregado', false, 'membro', 'Suspenso Um', null, null);
update public.members set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000a5';

insert into public.announcements (id, title, body, visibility, expires_on) values
  ('00000000-0000-0000-0000-0000000000c1', 'Festa aberta', 'Todos convidados', 'public', null),
  ('00000000-0000-0000-0000-0000000000c2', 'Aviso interno', 'Só da casa', 'members', null),
  ('00000000-0000-0000-0000-0000000000c3', 'Aviso vencido', 'Passou', 'public', current_date - 3),
  ('00000000-0000-0000-0000-0000000000c4', 'Interno vencido', 'Passou', 'members', current_date - 3);

insert into public.stories (id, author_id, title, body) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a3', 'A mudança de 2007', 'Chegamos com um sofá e uma caixa de panelas.'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a4', 'Churrasco épico', 'Foi o melhor de todos os tempos, sem dúvida.');

create function public.t_login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
grant execute on function public.t_login(uuid) to authenticated;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Visitante
set local role anon;
select is((select count(*) from public.announcements)::int, 1, 'visitante vê só comunicado público e vigente');
select throws_ok($$select * from public.stories$$, '42501', null, 'visitante não lê histórias');
reset role;

-- Integrante
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*) from public.announcements)::int, 2, 'integrante vê públicos e internos vigentes');
select throws_ok($$insert into public.announcements (title, body, created_by) values ('Hack', 'texto', '00000000-0000-0000-0000-0000000000a3')$$, '42501', null, 'integrante não publica comunicado');
select is((select count(*) from public.stories)::int, 2, 'integrante lê histórias');
select lives_ok($$insert into public.stories (author_id, title, body) values ('00000000-0000-0000-0000-0000000000a3', 'Segunda história', 'Mais uma lembrança da república.')$$, 'integrante escreve história');
select throws_ok($$insert into public.stories (author_id, title, body) values ('00000000-0000-0000-0000-0000000000a4', 'Em nome de outro', 'Texto qualquer aqui.')$$, '42501', null, 'não escreve como outra pessoa');
update public.stories set title = 'Invadido' where id = '00000000-0000-0000-0000-0000000000d2';
select is((select title from public.stories where id = '00000000-0000-0000-0000-0000000000d2'), 'Churrasco épico', 'não edita história alheia');
delete from public.stories where id = '00000000-0000-0000-0000-0000000000d2';
select is((select count(*) from public.stories where id = '00000000-0000-0000-0000-0000000000d2')::int, 1, 'não apaga história alheia');
update public.stories set title = 'A mudança (revisada)' where id = '00000000-0000-0000-0000-0000000000d1';
select is((select title from public.stories where id = '00000000-0000-0000-0000-0000000000d1'), 'A mudança (revisada)', 'autor edita a própria');
select lives_ok($$insert into public.story_comments (story_id, author_id, body) values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a3', 'Fui nesse!')$$, 'integrante comenta');
select throws_ok($$insert into public.story_comments (story_id, author_id, body) values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a4', 'Em nome de outro')$$, '42501', null, 'não comenta como outra pessoa');
select throws_ok($$select public.story_set_hidden('00000000-0000-0000-0000-0000000000d2', true, 'x')$$, '42501', null, 'integrante não oculta história');
select lives_ok($$insert into public.story_photos (story_id, path, position) values ('00000000-0000-0000-0000-0000000000d1', 'a/b/1.webp', 0), ('00000000-0000-0000-0000-0000000000d1', 'a/b/2.webp', 1), ('00000000-0000-0000-0000-0000000000d1', 'a/b/3.webp', 2), ('00000000-0000-0000-0000-0000000000d1', 'a/b/4.webp', 3)$$, 'autor anexa 4 fotos');
select throws_ok($$insert into public.story_photos (story_id, path, position) values ('00000000-0000-0000-0000-0000000000d1', 'a/b/5.webp', 0)$$, null, null, 'quinta foto é recusada');
select throws_ok($$insert into public.story_photos (story_id, path, position) values ('00000000-0000-0000-0000-0000000000d2', 'a/b/x.webp', 0)$$, '42501', null, 'não anexa foto em história alheia');
select is((select count(*) from public.member_names(array['00000000-0000-0000-0000-0000000000a4']::uuid[]))::int, 1, 'integrante resolve nomes');

-- Moderação
select public.t_login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$select public.story_set_hidden('00000000-0000-0000-0000-0000000000d2', true, 'Fora do tema')$$, 'moderador oculta história');
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*) from public.stories where id = '00000000-0000-0000-0000-0000000000d2')::int, 0, 'história oculta some para outros integrantes');
select throws_ok($$insert into public.story_comments (story_id, author_id, body) values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a3', 'Ainda comento?')$$, '42501', null, 'não comenta história oculta');
select public.t_login('00000000-0000-0000-0000-0000000000a4');
select is((select count(*) from public.stories where id = '00000000-0000-0000-0000-0000000000d2')::int, 1, 'autor ainda vê a própria história oculta');
select public.t_login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$delete from public.story_comments where story_id = '00000000-0000-0000-0000-0000000000d2'$$, 'moderador remove comentário');
select lives_ok($$insert into public.announcements (title, body, created_by) values ('Aviso do mod', 'Texto do aviso', '00000000-0000-0000-0000-0000000000a2')$$, 'moderador publica comunicado');

-- Suspenso
select public.t_login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*) from public.stories)::int, 0, 'suspenso não lê histórias');
select is((select count(*) from public.announcements)::int, 1, 'suspenso vê só o público vigente');

-- Administrador
select public.t_login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*) from public.announcements)::int, 6 - 1, 'publicador vê todos, inclusive vencidos');
select lives_ok($$delete from public.announcements where id = '00000000-0000-0000-0000-0000000000c1'$$, 'administrador apaga comunicado');
select is((select count(*) from public.audit_logs where entity = 'announcements' and action = 'delete')::int, 1, 'exclusão de comunicado é auditada');
select is((select count(*) from public.audit_logs where entity = 'story_comments' and action = 'moderate_delete')::int, 1, 'remoção por moderador é auditada');

select * from finish();
rollback;

-- Museu: visibilidade por álbum, autoria, moderação e limites.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(21);

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

insert into public.albums (id, title, year, visibility, created_by) values
  ('00000000-0000-0000-0000-0000000000b1', 'Festa de 2008', 2008, 'public', '00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000b2', 'Só da casa', 2010, 'members', '00000000-0000-0000-0000-0000000000a3');
insert into public.album_photos (id, album_id, uploaded_by, path) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a3', 'a/1.webp'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a3', 'a/2.webp');

create function public.t_login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
grant execute on function public.t_login(uuid) to authenticated;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

set local role anon;
select is((select count(*) from public.albums)::int, 1, 'visitante vê só álbum público');
select is((select count(*) from public.album_photos)::int, 1, 'visitante vê só foto de álbum público');
reset role;

select public.t_login('00000000-0000-0000-0000-0000000000a4');
select is((select count(*) from public.albums)::int, 2, 'integrante vê todos os álbuns');
select lives_ok($$insert into public.albums (title, year, created_by) values ('Meu álbum', 2015, '00000000-0000-0000-0000-0000000000a4')$$, 'integrante cria álbum');
select throws_ok($$insert into public.albums (title, created_by) values ('Em nome de outro', '00000000-0000-0000-0000-0000000000a3')$$, '42501', null, 'não cria álbum em nome de outro');
select lives_ok($$insert into public.album_photos (album_id, uploaded_by, path) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a4', 'b/1.webp')$$, 'integrante envia foto para álbum alheio');
select throws_ok($$insert into public.album_photos (album_id, uploaded_by, path) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a3', 'b/2.webp')$$, '42501', null, 'não envia foto em nome de outro');
update public.albums set title = 'Invadido' where id = '00000000-0000-0000-0000-0000000000b1';
select is((select title from public.albums where id = '00000000-0000-0000-0000-0000000000b1'), 'Festa de 2008', 'não edita álbum alheio');
delete from public.album_photos where id = '00000000-0000-0000-0000-0000000000e1';
select is((select count(*) from public.album_photos where id = '00000000-0000-0000-0000-0000000000e1')::int, 1, 'não apaga foto alheia');
select throws_ok($$select public.museum_set_hidden('photo', '00000000-0000-0000-0000-0000000000e1', true, 'x')$$, '42501', null, 'integrante não oculta');

-- A criadora do álbum apaga foto enviada por outro.
select public.t_login('00000000-0000-0000-0000-0000000000a3');
delete from public.album_photos where uploaded_by = '00000000-0000-0000-0000-0000000000a4';
select is((select count(*) from public.album_photos where uploaded_by = '00000000-0000-0000-0000-0000000000a4')::int, 0, 'criadora apaga foto do próprio álbum');

-- Moderação
select public.t_login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$select public.museum_set_hidden('album', '00000000-0000-0000-0000-0000000000b1', true, 'Fora do tema')$$, 'moderador oculta álbum');
select lives_ok($$select public.museum_set_hidden('photo', '00000000-0000-0000-0000-0000000000e2', true, null)$$, 'moderador oculta foto');
select throws_ok($$select public.museum_set_hidden('xx', '00000000-0000-0000-0000-0000000000e2', true, null)$$, '22023', null, 'tipo inválido é recusado');
select public.t_login('00000000-0000-0000-0000-0000000000a4');
select is((select count(*) from public.albums where id = '00000000-0000-0000-0000-0000000000b1')::int, 0, 'álbum oculto some para outros integrantes');
select is((select count(*) from public.album_photos where id = '00000000-0000-0000-0000-0000000000e2')::int, 0, 'foto oculta some para outros integrantes');
select throws_ok($$insert into public.album_photos (album_id, uploaded_by, path) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a4', 'c/1.webp')$$, '42501', null, 'não envia foto para álbum oculto');
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*) from public.albums where id = '00000000-0000-0000-0000-0000000000b1')::int, 1, 'criadora ainda vê o álbum oculto');
reset role;
set local role anon;
select is((select count(*) from public.albums)::int, 0, 'álbum público oculto some para visitantes');
reset role;
select public.t_login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*) from public.albums where visibility = 'members')::int, 0, 'suspenso não vê álbum interno');

-- Limite de 100 fotos
reset role;
insert into public.album_photos (album_id, uploaded_by, path)
select '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a3', 'l/' || g || '.webp' from generate_series(1, 99) g;
select throws_ok($$insert into public.album_photos (album_id, uploaded_by, path) values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a3', 'l/x.webp')$$, '23514', null, 'álbum aceita no máximo 100 fotos');
select * from finish();
rollback;

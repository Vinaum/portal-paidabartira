-- Portal público: só quem autorizou aparece; números agregados.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'um@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'dois@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'tres@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'quatro@example.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'cinco@example.test');
select private.create_member('00000000-0000-0000-0000-0000000000a1', 'atual_morador', false, 'membro', 'Ana Atual', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a2', 'ex_morador', true, 'membro', 'Fabio Fundador', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a3', 'agregado', false, 'membro', 'Gui Agregado', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a4', 'ex_morador', false, 'membro', 'Eva Escondida', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a5', 'atual_morador', false, 'membro', 'Sam Suspenso', null, null);
update public.profiles set show_on_public_portal = true
 where member_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a5');
update public.members set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000a5';
insert into public.profile_photo (member_id, media_path) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1/avatar/x.webp'),
  ('00000000-0000-0000-0000-0000000000a2', 'a2/avatar/x.webp');
update public.profile_privacy set visibility = 'public'
 where member_id = '00000000-0000-0000-0000-0000000000a1' and section = 'photo';

grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

set local role anon;
select is((select count(*) from public.public_people())::int, 2, 'visitante vê só quem autorizou, ativo e morador/ex-morador');
select is((select array_agg(display_name order by display_name) from public.public_people()), array['Ana', 'Fabio'], 'sem agregado, sem escondido, sem suspenso');
select is((select is_founder from public.public_people() where display_name = 'Fabio'), true, 'fundador marcado');
select is((select photo_path from public.public_people() where display_name = 'Ana'), 'a1/avatar/x.webp', 'foto pública aparece');
select is((select photo_path from public.public_people() where display_name = 'Fabio'), null, 'foto de seção não pública não vaza');
select is((select display_name from public.public_people() limit 1), 'Fabio', 'fundadores vêm primeiro');
select is((select current_residents from public.public_house_stats()), 1, 'conta moradores atuais ativos');
select is((select former_residents from public.public_house_stats()), 2, 'conta ex-moradores ativos');
select is((select founders from public.public_house_stats()), 1, 'conta fundadores');
select throws_ok($$select * from public.residency_periods$$, '42501', null, 'período na casa continua fechado a visitantes');
reset role;

select * from finish();
rollback;

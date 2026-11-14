-- Aniversários: só dia e mês, visibilidade por seção, sem acesso de visitantes.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'um@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'dois@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'tres@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'susp@example.test');
select private.create_member('00000000-0000-0000-0000-0000000000a1', 'atual_morador', false, 'membro', 'Pessoa Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a2', 'agregado', false, 'membro', 'Pessoa Dois', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a3', 'agregado', false, 'membro', 'Pessoa Tres', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a4', 'agregado', false, 'membro', 'Pessoa Quatro', null, null);

insert into public.profile_birthday (member_id, birth_day, birth_month) values
  ('00000000-0000-0000-0000-0000000000a1', 15, 3),
  ('00000000-0000-0000-0000-0000000000a2', 29, 2),
  ('00000000-0000-0000-0000-0000000000a4', 1, 1);
update public.profile_privacy set visibility = 'private'
 where member_id = '00000000-0000-0000-0000-0000000000a2' and section = 'birthday';
update public.members set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000a4';

create function public.t_login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
grant execute on function public.t_login(uuid) to authenticated;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

select is((select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'profile_section' and e.enumlabel = 'birthday')::int, 1, 'seção birthday existe');
select is((select visibility::text from public.profile_privacy where member_id = '00000000-0000-0000-0000-0000000000a3' and section = 'birthday'), 'members', 'novo integrante nasce com seção visível a integrantes');

set local role anon;
select throws_ok($$select * from public.profile_birthday$$, '42501', null, 'visitante não lê aniversários');
select throws_ok($$select * from public.list_birthdays()$$, '42501', null, 'visitante não lista aniversários');
reset role;

select public.t_login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*) from public.list_birthdays())::int, 1, 'integrante vê só quem compartilha e está ativo');
select is((select display_name from public.list_birthdays()), 'Pessoa', 'aparece quem preencheu e compartilha');
select throws_ok($$insert into public.profile_birthday (member_id, birth_day, birth_month) values ('00000000-0000-0000-0000-0000000000a3', 30, 2)$$, '23514', null, '30 de fevereiro é recusado');
select lives_ok($$insert into public.profile_birthday (member_id, birth_day, birth_month) values ('00000000-0000-0000-0000-0000000000a3', 29, 2)$$, '29 de fevereiro vale (ano bissexto)');

select public.t_login('00000000-0000-0000-0000-0000000000a2');
select is((select count(*) from public.list_birthdays())::int, 3, 'quem escolheu privado ainda vê o próprio e os compartilhados');
select throws_ok($$insert into public.profile_birthday (member_id, birth_day, birth_month) values ('00000000-0000-0000-0000-0000000000a3', 1, 1)$$, '42501', null, 'não grava aniversário de outra pessoa');

select * from finish();
rollback;

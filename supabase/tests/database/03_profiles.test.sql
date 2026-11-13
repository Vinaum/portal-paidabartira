-- Perfis: cada integrante edita só o que é seu, e o que edita não mexe em
-- papel, categoria ou status.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'suspenso@example.test');
select private.create_member('00000000-0000-0000-0000-0000000000a1', 'ex_morador', false, 'membro', 'Membro A da Silva', 'Aaa', null);
select private.create_member('00000000-0000-0000-0000-0000000000b1', 'atual_morador', false, 'membro', 'Membro B de Souza', 'Bbb', null);
select private.create_member('00000000-0000-0000-0000-0000000000c1', 'agregado', false, 'membro', 'Suspenso Pereira', null, null);
update public.members set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000c1';

create function public.t_login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
grant execute on function public.t_login(uuid) to authenticated;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Membro A edita o próprio perfil ---------------------------------------------
select public.t_login('00000000-0000-0000-0000-0000000000a1');

select lives_ok(
  $$update public.profiles set bio = 'Morei no quarto dos fundos.', current_city = 'Campinas'
     where member_id = '00000000-0000-0000-0000-0000000000a1'$$,
  'membro edita o próprio perfil');
select lives_ok(
  $$insert into public.profile_phone (member_id, phone, whatsapp)
    values ('00000000-0000-0000-0000-0000000000a1', '+55 19 90000-0001', null)
    on conflict (member_id) do update set phone = excluded.phone, whatsapp = excluded.whatsapp$$,
  'membro grava a própria seção (insere)');
select lives_ok(
  $$insert into public.profile_phone (member_id, phone, whatsapp)
    values ('00000000-0000-0000-0000-0000000000a1', '+55 19 90000-0002', '+55 19 90000-0002')
    on conflict (member_id) do update set phone = excluded.phone, whatsapp = excluded.whatsapp$$,
  'membro grava a própria seção (atualiza)');
select lives_ok(
  $$insert into public.education (member_id, course, institution, start_year, end_year)
    values ('00000000-0000-0000-0000-0000000000a1', 'Engenharia de Computação', 'UNICAMP', 2006, 2011)$$,
  'membro adiciona formação');
select lives_ok(
  $$update public.profile_privacy set visibility = 'private'
     where member_id = '00000000-0000-0000-0000-0000000000a1' and section = 'academic'$$,
  'membro muda a própria privacidade');
select lives_ok(
  $$select public.set_my_residency(date '2006-03-01', date '2011-12-15')$$,
  'membro informa o próprio período de residência');
select throws_ok(
  $$select public.set_my_residency(date '2011-01-01', date '2006-01-01')$$,
  '23514', null, 'saída antes da entrada é recusada');
select throws_ok(
  $$select public.set_my_residency(current_date + 30, null)$$,
  '23514', null, 'data futura é recusada');

-- Membro A tenta mexer no que é de B ----------------------------------------------
select results_eq(
  $$with x as (update public.profiles set bio = 'invadido'
                where member_id = '00000000-0000-0000-0000-0000000000b1' returning 1)
    select count(*)::int from x$$,
  $$values (0)$$, 'membro não edita perfil alheio');
select throws_ok(
  $$insert into public.profile_phone (member_id, phone) values ('00000000-0000-0000-0000-0000000000b1', '000')$$,
  '42501', null, 'membro não grava seção de outro integrante');
select throws_ok(
  $$insert into public.education (member_id, course, institution)
    values ('00000000-0000-0000-0000-0000000000b1', 'Curso Falso', 'Lugar Falso')$$,
  '42501', null, 'membro não adiciona formação a outro integrante');
select throws_ok(
  $$update public.profiles set member_id = '00000000-0000-0000-0000-0000000000b1'
     where member_id = '00000000-0000-0000-0000-0000000000a1'$$,
  null, null, 'membro não transfere o próprio perfil para outro integrante');
select results_eq(
  $$with x as (update public.profile_privacy set visibility = 'public'
                where member_id = '00000000-0000-0000-0000-0000000000b1' returning 1)
    select count(*)::int from x$$,
  $$values (0)$$, 'membro não muda a privacidade de outro');

-- Membro B vê o que A liberou e não vê o que A fechou ------------------------------------
select public.t_login('00000000-0000-0000-0000-0000000000b1');
select is_empty(
  $$select 1 from public.education where member_id = '00000000-0000-0000-0000-0000000000a1'$$,
  'formação marcada como privada não aparece para outro membro');
select is_empty(
  $$select 1 from public.profile_phone where member_id = '00000000-0000-0000-0000-0000000000a1'$$,
  'telefone (privado por padrão) não aparece para outro membro');

-- Suspenso -------------------------------------------------------------------------
select public.t_login('00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  $$select public.set_my_residency(date '2010-01-01', null)$$,
  '42501', null, 'suspenso não altera o período de residência');

reset role;
select results_eq(
  $$select role::text, category::text, status::text, joined_republic_on, left_republic_on
      from public.members where id = '00000000-0000-0000-0000-0000000000a1'$$,
  $$values ('membro', 'ex_morador', 'active', date '2006-03-01', date '2011-12-15')$$,
  'período gravado, sem alterar papel, categoria ou status');

select * from finish();
rollback;

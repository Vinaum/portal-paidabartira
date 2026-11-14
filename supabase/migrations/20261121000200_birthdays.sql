-- Aniversários na agenda.
--
-- Minimização: guarda só dia e mês (nunca o ano, para não expor idade). Só entra
-- na agenda quem preencheu e deixou a seção 'birthday' visível para integrantes;
-- a visibilidade segue a regra única de `private.can_view_section`.

create table public.profile_birthday (
  member_id uuid primary key references public.members (id) on delete cascade,
  birth_day smallint not null check (birth_day between 1 and 31),
  birth_month smallint not null check (birth_month between 1 and 12),
  updated_at timestamptz not null default now(),
  check (birth_day <= (array[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])[birth_month])
);
alter table public.profile_birthday enable row level security;

-- Sem acesso para visitantes: aniversário nunca vai ao portal público.
grant select, insert, update, delete on public.profile_birthday to authenticated;

create policy profile_birthday_select on public.profile_birthday
  for select to authenticated
  using (private.can_view_section(member_id, 'birthday'));
create policy profile_birthday_insert_own on public.profile_birthday
  for insert to authenticated
  with check (member_id = (select auth.uid()) and (select private.is_active_member()));
create policy profile_birthday_update_own on public.profile_birthday
  for update to authenticated
  using (member_id = (select auth.uid()) and (select private.is_active_member()))
  with check (member_id = (select auth.uid()));
create policy profile_birthday_delete_own on public.profile_birthday
  for delete to authenticated
  using (member_id = (select auth.uid()) and (select private.is_active_member()));

-- Quem já é integrante: seção visível a integrantes (sem dado, nada aparece até preencher).
insert into public.profile_privacy (member_id, section, visibility)
select id, 'birthday', 'members' from public.members
on conflict (member_id, section) do nothing;

create function private.add_birthday_privacy() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profile_privacy (member_id, section, visibility)
  values (new.id, 'birthday', 'members')
  on conflict (member_id, section) do nothing;
  return new;
end;
$$;
revoke execute on function private.add_birthday_privacy() from public, anon, authenticated;
create trigger members_add_birthday_privacy
  after insert on public.members
  for each row execute function private.add_birthday_privacy();

-- Lista para a agenda. SECURITY INVOKER: a RLS decide quem aparece (privacidade e status).
create function public.list_birthdays()
returns table (member_id uuid, display_name text, birth_day smallint, birth_month smallint)
language sql stable security invoker
set search_path = ''
as $$
  select b.member_id, p.display_name, b.birth_day, b.birth_month
  from public.profile_birthday b
  join public.profiles p on p.member_id = b.member_id
  order by b.birth_month, b.birth_day, p.display_name
$$;
revoke execute on function public.list_birthdays() from public, anon, authenticated;
grant execute on function public.list_birthdays() to authenticated, service_role;

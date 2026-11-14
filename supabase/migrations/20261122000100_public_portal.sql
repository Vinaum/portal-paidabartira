-- Portal público: pessoas que autorizaram aparecer e números da casa.
--
-- Só aparece quem marcou `show_on_public_portal` e está ativo. Mostra apenas
-- nome de exibição, apelido, apresentação, categoria, fundador e (se a seção
-- foto for pública) a foto. O período na casa continua restrito a integrantes,
-- como já decidido; agregados não aparecem.

insert into public.republic_settings (key, value, is_public) values
  ('republic.house_photo', 'null', true)
on conflict (key) do nothing;

create function public.public_people()
returns table (
  member_id uuid,
  display_name text,
  nickname text,
  bio text,
  category public.member_category,
  is_founder boolean,
  photo_path text
)
language sql stable security definer
set search_path = ''
as $$
  select m.id, p.display_name, p.nickname, p.bio, m.category, m.is_founder,
         case when private.can_view_section(m.id, 'photo') then ph.media_path end
  from public.members m
  join public.profiles p on p.member_id = m.id
  left join public.profile_photo ph on ph.member_id = m.id
  where m.status = 'active'
    and p.show_on_public_portal
    and m.category in ('atual_morador', 'ex_morador')
  order by m.is_founder desc, p.display_name
$$;

-- Números sem identificar ninguém.
create function public.public_house_stats()
returns table (current_residents integer, former_residents integer, founders integer)
language sql stable security definer
set search_path = ''
as $$
  select
    (count(*) filter (where category = 'atual_morador'))::int,
    (count(*) filter (where category = 'ex_morador'))::int,
    (count(*) filter (where is_founder))::int
  from public.members
  where status = 'active' and category in ('atual_morador', 'ex_morador')
$$;

revoke execute on function public.public_people(), public.public_house_stats() from public, anon, authenticated;
grant execute on function public.public_people(), public.public_house_stats() to anon, authenticated, service_role;

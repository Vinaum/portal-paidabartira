-- Perfis. A RLS protege linhas, não colunas; por isso cada seção de
-- privacidade (foto, e-mails, telefone, endereço, profissional, acadêmico)
-- é uma tabela própria, liberada pela mesma função `can_view_section`.

create table public.profiles (
  member_id uuid primary key references public.members (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 3 and 120),
  display_name text not null check (char_length(display_name) between 1 and 60),
  nickname text check (char_length(nickname) <= 60),
  bio text check (char_length(bio) <= 2000),
  origin_country text check (char_length(origin_country) <= 80),
  origin_state text check (char_length(origin_state) <= 80),
  origin_city text check (char_length(origin_city) <= 80),
  current_city text check (char_length(current_city) <= 80),
  current_country text check (char_length(current_country) <= 80),
  -- Autorização do próprio integrante para aparecer no portal público.
  show_on_public_portal boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

create table public.profile_privacy (
  member_id uuid not null references public.members (id) on delete cascade,
  section public.profile_section not null,
  visibility public.visibility not null,
  primary key (member_id, section)
);
alter table public.profile_privacy enable row level security;

create table public.profile_photo (
  member_id uuid primary key references public.members (id) on delete cascade,
  media_path text not null check (char_length(media_path) <= 300),
  updated_at timestamptz not null default now()
);

create table public.profile_emails (
  member_id uuid primary key references public.members (id) on delete cascade,
  -- E-mail institucional de contato. O e-mail de login vive só no Auth.
  official_email text check (char_length(official_email) <= 254 and official_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  updated_at timestamptz not null default now()
);

create table public.profile_phone (
  member_id uuid primary key references public.members (id) on delete cascade,
  phone text check (char_length(phone) <= 30),
  whatsapp text check (char_length(whatsapp) <= 30),
  updated_at timestamptz not null default now()
);

create table public.profile_address (
  member_id uuid primary key references public.members (id) on delete cascade,
  street text check (char_length(street) <= 160),
  complement text check (char_length(complement) <= 80),
  district text check (char_length(district) <= 80),
  city text check (char_length(city) <= 80),
  state text check (char_length(state) <= 80),
  postal_code text check (char_length(postal_code) <= 20),
  country text check (char_length(country) <= 80),
  updated_at timestamptz not null default now()
);

create table public.profile_professional (
  member_id uuid primary key references public.members (id) on delete cascade,
  company text check (char_length(company) <= 120),
  job_title text check (char_length(job_title) <= 120),
  field text check (char_length(field) <= 120),
  linkedin_url text check (char_length(linkedin_url) <= 300 and linkedin_url ~ '^https://'),
  website_url text check (char_length(website_url) <= 300 and website_url ~ '^https?://'),
  pitch text check (char_length(pitch) <= 2000),
  skills text[] not null default '{}' check (cardinality(skills) <= 30),
  updated_at timestamptz not null default now()
);

create table public.education (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  course text not null check (char_length(course) between 2 and 120),
  institution text not null check (char_length(institution) between 2 and 120),
  start_year smallint check (start_year between 1950 and 2100),
  end_year smallint check (end_year between 1950 and 2100),
  constraint education_years_check check (end_year is null or start_year is null or end_year >= start_year)
);
create index education_member_idx on public.education (member_id);

alter table public.profile_photo enable row level security;
alter table public.profile_emails enable row level security;
alter table public.profile_phone enable row level security;
alter table public.profile_address enable row level security;
alter table public.profile_professional enable row level security;
alter table public.education enable row level security;

-- ---------------------------------------------------------------------------
-- Regra única de visibilidade por seção.
--   dono                       -> sempre vê
--   'public'                   -> membros ativos; e anônimos, se o dono
--                                 autorizou aparecer no portal público
--   'members'                  -> membros ativos
--   'private' ou sem registro  -> ninguém além do dono (nem administradores)
-- Dados de quem não está ativo só são visíveis ao próprio dono.
-- ---------------------------------------------------------------------------
create function private.can_view_section(p_owner uuid, p_section public.profile_section) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    p_owner = (select auth.uid())
    or exists (
      select 1
      from public.members m
      join public.profiles p on p.member_id = m.id
      join public.profile_privacy pp on pp.member_id = m.id and pp.section = p_section
      where m.id = p_owner
        and m.status = 'active'
        and (
          (pp.visibility in ('public', 'members') and private.is_active_member())
          or (pp.visibility = 'public' and p.show_on_public_portal)
        )
    );
$$;
grant execute on function private.can_view_section(uuid, public.profile_section)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Políticas de perfil
-- ---------------------------------------------------------------------------
-- Anônimos recebem só colunas de apresentação, e só de quem autorizou.
grant select (member_id, display_name, nickname, bio) on public.profiles to anon;
grant select, update on public.profiles to authenticated;

create policy profiles_select_public on public.profiles
  for select to anon
  using (show_on_public_portal and (select private.member_is_active(member_id)));

create policy profiles_select_members on public.profiles
  for select to authenticated
  using (
    member_id = (select auth.uid())
    or ((select private.is_active_member()) and private.member_is_active(member_id))
  );

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (member_id = (select auth.uid()) and (select private.is_active_member()))
  with check (member_id = (select auth.uid()));

grant select, update on public.profile_privacy to authenticated;

create policy profile_privacy_select_own on public.profile_privacy
  for select to authenticated
  using (member_id = (select auth.uid()));

create policy profile_privacy_update_own on public.profile_privacy
  for update to authenticated
  using (member_id = (select auth.uid()) and (select private.is_active_member()))
  with check (member_id = (select auth.uid()));

-- Mesmo conjunto de políticas para todas as tabelas de seção.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('profile_photo', 'photo'),
      ('profile_emails', 'emails'),
      ('profile_phone', 'phone'),
      ('profile_address', 'address'),
      ('profile_professional', 'professional'),
      ('education', 'academic')
    ) as s (tbl, section)
  loop
    execute format('grant select on public.%I to anon', t.tbl);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t.tbl);

    execute format(
      'create policy %I on public.%I for select to anon, authenticated
         using (private.can_view_section(member_id, %L))',
      t.tbl || '_select', t.tbl, t.section);

    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (member_id = (select auth.uid()) and (select private.is_active_member()))',
      t.tbl || '_insert_own', t.tbl);

    execute format(
      'create policy %I on public.%I for update to authenticated
         using (member_id = (select auth.uid()) and (select private.is_active_member()))
         with check (member_id = (select auth.uid()))',
      t.tbl || '_update_own', t.tbl);

    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (member_id = (select auth.uid()) and (select private.is_active_member()))',
      t.tbl || '_delete_own', t.tbl);
  end loop;
end;
$$;

-- Diretório de integrantes e pedido de exclusão de conta.
--
-- A busca é uma função SECURITY INVOKER: roda com os direitos de quem chama,
-- então a RLS das tabelas de seção (foto, profissional, formação...) decide o
-- que cada pessoa enxerga. Um dado que o dono marcou como privado volta como
-- nulo e, por isso, também não casa com nenhum filtro: não dá para "descobrir"
-- a empresa de alguém filtrando por ela.

create extension if not exists unaccent with schema extensions;

-- Texto sem acento e em minúsculas. SECURITY DEFINER para não depender de quem
-- chama ter acesso ao schema `extensions`.
create function private.fold(p_text text) returns text
language sql stable security definer
set search_path = ''
as $$
  select extensions.unaccent(lower(p_text))
$$;
revoke execute on function private.fold(text) from public, anon;
grant execute on function private.fold(text) to authenticated, service_role;

create function private.search_pattern(p_text text) returns text
language sql immutable
set search_path = ''
as $$
  -- Escapa os curingas do LIKE e ignora acentos e maiúsculas.
  select case
    when nullif(btrim(p_text), '') is null then null
    else '%' || private.fold((replace(replace(replace(btrim(p_text), '\', '\\'), '%', '\%'), '_', '\_'))) || '%'
  end
$$;
grant execute on function private.search_pattern(text) to authenticated, service_role;

create function public.search_directory(
  p_query text default null,
  p_category public.member_category default null,
  p_founders_only boolean default false,
  p_course text default null,
  p_institution text default null,
  p_graduation_year integer default null,
  p_resident_year integer default null,
  p_profession text default null,
  p_company text default null,
  p_city text default null,
  p_country text default null,
  p_limit integer default 24,
  p_offset integer default 0
) returns table (
  member_id uuid,
  display_name text,
  nickname text,
  category public.member_category,
  is_founder boolean,
  current_city text,
  current_country text,
  photo_path text,
  job_title text,
  company text,
  courses text[],
  periods jsonb,
  total bigint
)
language sql stable security invoker
set search_path = ''
as $$
  with q as (
    select
      private.search_pattern(p_query) as name_like,
      private.search_pattern(p_course) as course_like,
      private.search_pattern(p_institution) as institution_like,
      private.search_pattern(p_profession) as profession_like,
      private.search_pattern(p_company) as company_like,
      private.search_pattern(p_city) as city_like,
      private.search_pattern(p_country) as country_like
  ),
  found as (
    select
      m.id,
      p.display_name,
      p.nickname,
      m.category,
      m.is_founder,
      p.current_city,
      p.current_country,
      ph.media_path as photo_path,
      pr.job_title,
      pr.company,
      coalesce(
        (select array_agg(e.course order by e.start_year desc nulls last) from public.education e where e.member_id = m.id),
        '{}'::text[]
      ) as courses,
      coalesce(
        (select jsonb_agg(jsonb_build_object('started_on', r.started_on, 'ended_on', r.ended_on) order by r.started_on)
         from public.residency_periods r where r.member_id = m.id),
        '[]'::jsonb
      ) as periods
    from public.members m
    join public.profiles p on p.member_id = m.id
    left join public.profile_photo ph on ph.member_id = m.id
    left join public.profile_professional pr on pr.member_id = m.id
    cross join q
    where m.status = 'active'
      and (select private.is_active_member())
      and (p_category is null or m.category = p_category)
      and (not p_founders_only or m.is_founder)
      and (
        q.name_like is null
        or private.fold(p.full_name) like q.name_like
        or private.fold(p.display_name) like q.name_like
        or private.fold(coalesce(p.nickname, '')) like q.name_like
      )
      and (
        q.course_like is null and q.institution_like is null and p_graduation_year is null
        or exists (
          select 1 from public.education e
          where e.member_id = m.id
            and (q.course_like is null or private.fold(e.course) like q.course_like)
            and (q.institution_like is null or private.fold(e.institution) like q.institution_like)
            and (p_graduation_year is null or e.end_year = p_graduation_year)
        )
      )
      and (
        p_resident_year is null
        or exists (
          select 1 from public.residency_periods r
          where r.member_id = m.id
            and extract(year from r.started_on) <= p_resident_year
            and (r.ended_on is null or extract(year from r.ended_on) >= p_resident_year)
        )
      )
      and (
        q.profession_like is null
        or private.fold(coalesce(pr.job_title, '')) like q.profession_like
        or private.fold(coalesce(pr.field, '')) like q.profession_like
      )
      and (q.company_like is null or private.fold(coalesce(pr.company, '')) like q.company_like)
      and (
        q.city_like is null
        or private.fold(coalesce(p.current_city, '')) like q.city_like
        or private.fold(coalesce(p.origin_city, '')) like q.city_like
      )
      and (
        q.country_like is null
        or private.fold(coalesce(p.current_country, '')) like q.country_like
        or private.fold(coalesce(p.origin_country, '')) like q.country_like
      )
  )
  select
    f.id, f.display_name, f.nickname, f.category, f.is_founder, f.current_city, f.current_country,
    f.photo_path, f.job_title, f.company, f.courses, f.periods,
    count(*) over () as total
  from found f
  order by private.fold(f.display_name), f.id
  limit greatest(1, least(coalesce(p_limit, 24), 60))
  offset greatest(0, coalesce(p_offset, 0))
$$;

revoke execute on function public.search_directory(
  text, public.member_category, boolean, text, text, integer, integer, text, text, text, text, integer, integer
) from public, anon;
grant execute on function public.search_directory(
  text, public.member_category, boolean, text, text, integer, integer, text, text, text, text, integer, integer
) to authenticated, service_role;

-- Índice para a ordenação por nome (sem acento) e para as junções por integrante.
create index if not exists profiles_display_name_idx on public.profiles (lower(display_name));
create index if not exists education_member_end_idx on public.education (member_id, end_year);

-- ---------------------------------------------------------------------------
-- Pedido de exclusão de conta (LGPD): um pedido em aberto por tipo.
-- ---------------------------------------------------------------------------
create unique index if not exists data_requests_one_open_per_kind
  on public.data_requests (member_id, kind)
  where status in ('open', 'in_progress');

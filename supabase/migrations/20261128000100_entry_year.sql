-- Ano de ingresso na faculdade ("a turma"), como "06" para quem entrou em 2006.
-- É o jeito de os moradores se identificarem entre si, então vira filtro do
-- diretório e uma etiqueta nos cartões e no perfil.
--
-- Fica na identificação do perfil, que só integrantes ativos enxergam: o
-- visitante não tem permissão de ler esta coluna (a concessão ao `anon` é por
-- coluna e não a inclui), e `public_people` continua sem devolvê-la.

alter table public.profiles
  add column entry_year smallint
    check (entry_year is null or entry_year between 1950 and 2100);

create index profiles_entry_year_idx on public.profiles (entry_year) where entry_year is not null;

-- A busca ganha o filtro e devolve o ano. Mudou a assinatura: troca a função.
drop function public.search_directory(
  text, public.member_category, boolean, text, text, integer, integer, text, text, text, text, integer, integer
);

create function public.search_directory(
  p_query text default null,
  p_category public.member_category default null,
  p_founders_only boolean default false,
  p_course text default null,
  p_institution text default null,
  p_graduation_year integer default null,
  p_resident_year integer default null,
  p_entry_year integer default null,
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
  entry_year smallint,
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
      p.entry_year,
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
      and (p_entry_year is null or p.entry_year = p_entry_year)
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
    f.entry_year, f.photo_path, f.job_title, f.company, f.courses, f.periods,
    count(*) over () as total
  from found f
  order by private.fold(f.display_name), f.id
  limit greatest(1, least(coalesce(p_limit, 24), 60))
  offset greatest(0, coalesce(p_offset, 0))
$$;

revoke execute on function public.search_directory(
  text, public.member_category, boolean, text, text, integer, integer, integer, text, text, text, text, integer, integer
) from public, anon;
grant execute on function public.search_directory(
  text, public.member_category, boolean, text, text, integer, integer, integer, text, text, text, text, integer, integer
) to authenticated, service_role;

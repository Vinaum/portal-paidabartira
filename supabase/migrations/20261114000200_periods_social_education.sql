-- Ajustes de cadastro pedidos em 12/11/2026:
--   1. uma pessoa pode ter morado na república em mais de um período;
--   2. redes sociais listadas no perfil, junto com o LinkedIn;
--   3. uma formação pode estar em curso ou não ter sido concluída.

-- ---------------------------------------------------------------------------
-- 1. Períodos de residência (vários por integrante)
-- ---------------------------------------------------------------------------
create table public.residency_periods (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  -- Precisão de mês: sempre o dia 1.
  started_on date not null check (started_on >= date '1950-01-01' and extract(day from started_on) = 1),
  ended_on date check (extract(day from ended_on) = 1),
  constraint residency_periods_order_check check (ended_on is null or ended_on >= started_on),
  constraint residency_periods_unique_start unique (member_id, started_on)
);
create index residency_periods_member_idx on public.residency_periods (member_id, started_on);
alter table public.residency_periods enable row level security;

grant select, insert, update, delete on public.residency_periods to authenticated;

-- O período na casa faz parte do vínculo: é visível aos integrantes ativos
-- (base da busca do diretório), nunca a visitantes.
create policy residency_periods_select on public.residency_periods
  for select to authenticated
  using (
    member_id = (select auth.uid())
    or ((select private.is_active_member()) and private.member_is_active(member_id))
  );
create policy residency_periods_insert_own on public.residency_periods
  for insert to authenticated
  with check (member_id = (select auth.uid()) and (select private.is_active_member()));
create policy residency_periods_update_own on public.residency_periods
  for update to authenticated
  using (member_id = (select auth.uid()) and (select private.is_active_member()))
  with check (member_id = (select auth.uid()));
create policy residency_periods_delete_own on public.residency_periods
  for delete to authenticated
  using (member_id = (select auth.uid()) and (select private.is_active_member()));

-- Limites: datas não futuras e no máximo 12 períodos por integrante.
create function private.check_residency_period() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.started_on > current_date or (new.ended_on is not null and new.ended_on > current_date) then
    raise exception 'Período no futuro' using errcode = 'check_violation';
  end if;
  if tg_op = 'INSERT' and
     (select count(*) from public.residency_periods where member_id = new.member_id) >= 12 then
    raise exception 'Limite de períodos atingido' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_residency_period() from public, anon, authenticated;
create trigger residency_periods_check
  before insert or update on public.residency_periods
  for each row execute function private.check_residency_period();

-- Leva para a nova tabela o que já tinha sido informado nas duas datas únicas.
insert into public.residency_periods (member_id, started_on, ended_on)
select id, date_trunc('month', joined_republic_on)::date, date_trunc('month', left_republic_on)::date
from public.members
where joined_republic_on is not null;

drop function public.set_my_residency(date, date);

-- A função administrativa recebia as duas datas; passa a cuidar só de
-- categoria, fundador e status. Os períodos são editados pelo próprio integrante.
drop function public.admin_update_member(uuid, public.member_category, boolean, public.member_status, date, date, text);
create function public.admin_update_member(
  p_member_id uuid,
  p_category public.member_category,
  p_is_founder boolean,
  p_status public.member_status,
  p_reason text default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old public.members;
begin
  if not private.has_permission('members.manage') then
    raise exception 'Sem permissão para gerenciar integrantes' using errcode = 'insufficient_privilege';
  end if;
  if p_member_id = (select auth.uid()) then
    raise exception 'Ninguém altera o próprio vínculo' using errcode = 'insufficient_privilege';
  end if;

  select * into v_old from public.members where id = p_member_id for update;
  if not found then
    raise exception 'Integrante não encontrado' using errcode = 'no_data_found';
  end if;
  if v_old.role in ('administrador', 'superadmin') and not private.is_superadmin() then
    raise exception 'Somente o superadmin altera administradores' using errcode = 'insufficient_privilege';
  end if;

  update public.members
    set category = p_category,
        is_founder = p_is_founder,
        status = p_status
    where id = p_member_id;

  insert into public.membership_history (member_id, field, old_value, new_value, reason, changed_by)
  select p_member_id, c.field, c.old_value, c.new_value, p_reason, (select auth.uid())
  from (values
    ('category', v_old.category::text, p_category::text),
    ('is_founder', v_old.is_founder::text, p_is_founder::text),
    ('status', v_old.status::text, p_status::text)
  ) as c (field, old_value, new_value)
  where c.old_value is distinct from c.new_value;

  perform private.log_audit('member.update', 'members', p_member_id::text,
    jsonb_build_object(
      'before', jsonb_build_object('category', v_old.category, 'is_founder', v_old.is_founder, 'status', v_old.status),
      'after', jsonb_build_object('category', p_category, 'is_founder', p_is_founder, 'status', p_status),
      'reason', p_reason));
end;
$$;
revoke execute on function public.admin_update_member(uuid, public.member_category, boolean, public.member_status, text)
  from public, anon, authenticated;
grant execute on function public.admin_update_member(uuid, public.member_category, boolean, public.member_status, text)
  to authenticated, service_role;

alter table public.members drop column joined_republic_on, drop column left_republic_on;

-- ---------------------------------------------------------------------------
-- 2. Redes sociais (seção de privacidade própria: 'social')
-- ---------------------------------------------------------------------------
create table public.profile_social (
  member_id uuid primary key references public.members (id) on delete cascade,
  linkedin_url text check (char_length(linkedin_url) <= 300 and linkedin_url ~ '^https://'),
  instagram_url text check (char_length(instagram_url) <= 300 and instagram_url ~ '^https://'),
  facebook_url text check (char_length(facebook_url) <= 300 and facebook_url ~ '^https://'),
  x_url text check (char_length(x_url) <= 300 and x_url ~ '^https://'),
  github_url text check (char_length(github_url) <= 300 and github_url ~ '^https://'),
  other_url text check (char_length(other_url) <= 300 and other_url ~ '^https://'),
  updated_at timestamptz not null default now()
);
alter table public.profile_social enable row level security;

grant select on public.profile_social to anon;
grant select, insert, update, delete on public.profile_social to authenticated;

create policy profile_social_select on public.profile_social
  for select to anon, authenticated
  using (private.can_view_section(member_id, 'social'));
create policy profile_social_insert_own on public.profile_social
  for insert to authenticated
  with check (member_id = (select auth.uid()) and (select private.is_active_member()));
create policy profile_social_update_own on public.profile_social
  for update to authenticated
  using (member_id = (select auth.uid()) and (select private.is_active_member()))
  with check (member_id = (select auth.uid()));
create policy profile_social_delete_own on public.profile_social
  for delete to authenticated
  using (member_id = (select auth.uid()) and (select private.is_active_member()));

-- Privacidade da nova seção para quem já é integrante. O LinkedIn sai da
-- seção profissional, então a seção social herda a visibilidade que a pessoa
-- tinha escolhido para a profissional: nada fica mais exposto do que estava.
insert into public.profile_privacy (member_id, section, visibility)
select m.id, 'social', coalesce(pp.visibility, 'members')
from public.members m
left join public.profile_privacy pp on pp.member_id = m.id and pp.section = 'professional'
on conflict (member_id, section) do nothing;

insert into public.profile_social (member_id, linkedin_url)
select member_id, linkedin_url from public.profile_professional where linkedin_url is not null;
alter table public.profile_professional drop column linkedin_url;

-- Novos integrantes: a linha de privacidade da seção social nasce junto.
create function private.add_social_privacy() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profile_privacy (member_id, section, visibility)
  values (new.id, 'social', 'members')
  on conflict (member_id, section) do nothing;
  return new;
end;
$$;
revoke execute on function private.add_social_privacy() from public, anon, authenticated;
create trigger members_add_social_privacy
  after insert on public.members
  for each row execute function private.add_social_privacy();

-- ---------------------------------------------------------------------------
-- 3. Situação da formação
-- ---------------------------------------------------------------------------
alter table public.education
  add column completion text not null default 'completed'
    check (completion in ('completed', 'in_progress', 'not_completed'));
-- O que já existia sem ano de conclusão é tratado como "em curso".
update public.education set completion = 'in_progress' where end_year is null;

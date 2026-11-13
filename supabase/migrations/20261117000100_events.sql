-- Eventos e confirmação de presença.
--
-- Quem vê o quê:
--   visitante  -> eventos públicos publicados ou cancelados (sem dados de quem criou);
--   integrante -> todos os eventos publicados ou cancelados;
--   events.manage (moderador, administrador) -> também os rascunhos, e escreve.
-- A confirmação de presença é só de integrantes ativos, em evento publicado
-- que ainda não terminou.

create type public.event_visibility as enum ('public', 'members');
create type public.event_status as enum ('draft', 'published', 'cancelled');
create type public.rsvp_answer as enum ('going', 'maybe', 'not_going');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text check (char_length(description) <= 4000),
  location text check (char_length(location) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz,
  visibility public.event_visibility not null default 'members',
  status public.event_status not null default 'draft',
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_period_check check (ends_at is null or ends_at >= starts_at)
);
create index events_status_starts_idx on public.events (status, starts_at);
alter table public.events enable row level security;

create trigger events_touch before update on public.events
  for each row execute function private.touch_updated_at();
create trigger events_audit after insert or update or delete on public.events
  for each row execute function private.audit_row_change('id');

create table public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  answer public.rsvp_answer not null,
  guests smallint not null default 0 check (guests between 0 and 10),
  updated_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
create index event_rsvps_member_idx on public.event_rsvps (member_id);
alter table public.event_rsvps enable row level security;
create trigger event_rsvps_touch before update on public.event_rsvps
  for each row execute function private.touch_updated_at();

-- Evento aberto a confirmação: publicado e ainda não terminou.
create function private.event_accepts_rsvp(p_event_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.status = 'published'
      and coalesce(e.ends_at, e.starts_at) > now()
  )
$$;
revoke execute on function private.event_accepts_rsvp(uuid) from public, anon;
grant execute on function private.event_accepts_rsvp(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Permissões de tabela (explícitas) e políticas
-- ---------------------------------------------------------------------------
-- Visitante lê só colunas de apresentação (sem created_by).
grant select (id, title, description, location, starts_at, ends_at, visibility, status) on public.events to anon;
grant select on public.events to authenticated;
grant insert (title, description, location, starts_at, ends_at, visibility, status, created_by) on public.events to authenticated;
grant update (title, description, location, starts_at, ends_at, visibility, status) on public.events to authenticated;
grant delete on public.events to authenticated;

create policy events_select_public on public.events
  for select to anon
  using (visibility = 'public' and status in ('published', 'cancelled'));

create policy events_select_authenticated on public.events
  for select to authenticated
  using (
    (status in ('published', 'cancelled') and (select private.is_active_member()))
    or (select private.has_permission('events.manage'))
  );

create policy events_insert on public.events
  for insert to authenticated
  with check ((select private.has_permission('events.manage')) and created_by = (select auth.uid()));

create policy events_update on public.events
  for update to authenticated
  using ((select private.has_permission('events.manage')))
  with check ((select private.has_permission('events.manage')));

-- Só rascunho se apaga; evento publicado se cancela (fica o registro).
create policy events_delete on public.events
  for delete to authenticated
  using ((select private.has_permission('events.manage')) and status = 'draft');

grant select on public.event_rsvps to authenticated;
grant insert (event_id, member_id, answer, guests) on public.event_rsvps to authenticated;
grant update (answer, guests) on public.event_rsvps to authenticated;
grant delete on public.event_rsvps to authenticated;

create policy event_rsvps_select on public.event_rsvps
  for select to authenticated
  using (
    (select private.is_active_member())
    and exists (select 1 from public.events e where e.id = event_id and e.status in ('published', 'cancelled'))
  );

create policy event_rsvps_insert_own on public.event_rsvps
  for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and (select private.is_active_member())
    and (select private.event_accepts_rsvp(event_id))
  );

create policy event_rsvps_update_own on public.event_rsvps
  for update to authenticated
  using (member_id = (select auth.uid()) and (select private.is_active_member()))
  with check (
    member_id = (select auth.uid())
    and (select private.is_active_member())
    and (select private.event_accepts_rsvp(event_id))
  );

create policy event_rsvps_delete_own on public.event_rsvps
  for delete to authenticated
  using (member_id = (select auth.uid()) and (select private.is_active_member()));

-- Quem confirmou: nome de apresentação e resposta. SECURITY INVOKER, então só
-- integrantes ativos recebem linhas, e só de eventos que já enxergam.
create function public.event_attendees(p_event_id uuid)
returns table (member_id uuid, display_name text, answer public.rsvp_answer, guests smallint)
language sql stable security invoker
set search_path = ''
as $$
  select r.member_id, p.display_name, r.answer, r.guests
  from public.event_rsvps r
  join public.profiles p on p.member_id = r.member_id
  where r.event_id = p_event_id
  order by (r.answer = 'going') desc, private.fold(p.display_name)
$$;
revoke execute on function public.event_attendees(uuid) from public, anon;
grant execute on function public.event_attendees(uuid) to authenticated, service_role;

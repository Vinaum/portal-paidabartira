-- Comunicados (mural) e histórias (memórias dos integrantes).
--
-- Comunicados: quem tem `announcements.publish` (administrador e, a partir daqui,
-- moderador) publica; cada um escolhe se é público ou só de integrantes; pode ser
-- fixado e ter data de validade.
--
-- Histórias: só integrantes ativos leem e escrevem. Publicam na hora; a moderação é
-- depois (`stories.moderate` oculta). O autor edita e apaga as suas. Até 4 fotos por
-- história, em bucket privado. Comentários curtos de integrantes.

insert into public.role_permissions (role, permission) values ('moderador', 'announcements.publish')
on conflict do nothing;

create type public.content_visibility as enum ('public', 'members');

-- ---------------------------------------------------------------------------
-- Comunicados
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  body text not null check (char_length(btrim(body)) between 3 and 4000),
  visibility public.content_visibility not null default 'members',
  is_pinned boolean not null default false,
  expires_on date,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
create index announcements_listing_idx on public.announcements (is_pinned desc, created_at desc);
create trigger announcements_touch before update on public.announcements
  for each row execute function private.touch_updated_at();

create function private.audit_announcement() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.announcements := case when tg_op = 'DELETE' then old else new end;
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values ((select auth.uid()), lower(tg_op), 'announcements', r.id::text,
          jsonb_build_object('title', r.title, 'visibility', r.visibility, 'is_pinned', r.is_pinned));
  return r;
end;
$$;
create trigger announcements_audit after insert or update or delete on public.announcements
  for each row execute function private.audit_announcement();

grant select on public.announcements to anon, authenticated;
grant insert (title, body, visibility, is_pinned, expires_on, created_by) on public.announcements to authenticated;
grant update (title, body, visibility, is_pinned, expires_on) on public.announcements to authenticated;
grant delete on public.announcements to authenticated;

create policy announcements_select_anon on public.announcements
  for select to anon
  using (visibility = 'public' and (expires_on is null or expires_on >= (now() at time zone 'America/Sao_Paulo')::date));
create policy announcements_select_auth on public.announcements
  for select to authenticated
  using (
    (select private.has_permission('announcements.publish'))
    or (
      (select private.is_active_member())
      and (expires_on is null or expires_on >= (now() at time zone 'America/Sao_Paulo')::date)
    )
    or (
      visibility = 'public' and (expires_on is null or expires_on >= (now() at time zone 'America/Sao_Paulo')::date)
    )
  );
create policy announcements_insert on public.announcements
  for insert to authenticated
  with check ((select private.has_permission('announcements.publish')) and created_by = (select auth.uid()));
create policy announcements_update on public.announcements
  for update to authenticated
  using ((select private.has_permission('announcements.publish')))
  with check ((select private.has_permission('announcements.publish')));
create policy announcements_delete on public.announcements
  for delete to authenticated
  using ((select private.has_permission('announcements.publish')));

-- ---------------------------------------------------------------------------
-- Histórias
-- ---------------------------------------------------------------------------
create table public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.members (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  body text not null check (char_length(btrim(body)) between 10 and 8000),
  era text check (char_length(era) <= 40),
  is_hidden boolean not null default false,
  hidden_reason text check (char_length(hidden_reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.stories enable row level security;
create index stories_listing_idx on public.stories (created_at desc);
create index stories_author_idx on public.stories (author_id);
create trigger stories_touch before update on public.stories
  for each row execute function private.touch_updated_at();

create table public.story_photos (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  path text not null check (char_length(path) <= 200),
  position smallint not null check (position between 0 and 3),
  created_at timestamptz not null default now(),
  unique (story_id, position)
);
alter table public.story_photos enable row level security;

create table public.story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories (id) on delete cascade,
  author_id uuid not null references public.members (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table public.story_comments enable row level security;
create index story_comments_story_idx on public.story_comments (story_id, created_at);

-- Auditoria de histórias e comentários: só ids e ações, nunca o texto.
create function private.audit_story() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.stories := case when tg_op = 'DELETE' then old else new end;
begin
  if tg_op = 'UPDATE' and old.is_hidden = new.is_hidden then
    return r;
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values ((select auth.uid()),
          case when tg_op = 'UPDATE' then (case when new.is_hidden then 'hide' else 'unhide' end) else lower(tg_op) end,
          'stories', r.id::text, jsonb_build_object('author_id', r.author_id));
  return r;
end;
$$;
create trigger stories_audit after insert or update or delete on public.stories
  for each row execute function private.audit_story();

create function private.audit_story_comment() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.author_id <> (select auth.uid()) then
    insert into public.audit_logs (actor_id, action, entity, entity_id, details)
    values ((select auth.uid()), 'moderate_delete', 'story_comments', old.id::text,
            jsonb_build_object('author_id', old.author_id, 'story_id', old.story_id));
  end if;
  return old;
end;
$$;
create trigger story_comments_audit after delete on public.story_comments
  for each row execute function private.audit_story_comment();

-- No máximo 4 fotos (a posição 0..3 única já garante, o gatilho dá mensagem clara).
create function private.story_photo_limit() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.story_photos where story_id = new.story_id) >= 4 then
    raise exception 'Cada história aceita até 4 fotos' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger story_photos_limit before insert on public.story_photos
  for each row execute function private.story_photo_limit();

-- Quem pode ver a história: integrante ativo; ocultas só para autor e moderação.
-- Usada pelas políticas de fotos e comentários (a RLS de `stories` já filtra).
grant select on public.stories to authenticated;
grant insert (author_id, title, body, era) on public.stories to authenticated;
grant update (title, body, era) on public.stories to authenticated;
grant delete on public.stories to authenticated;

create policy stories_select on public.stories
  for select to authenticated
  using (
    (select private.is_active_member())
    and (
      not is_hidden
      or author_id = (select auth.uid())
      or (select private.has_permission('stories.moderate'))
    )
  );
create policy stories_insert on public.stories
  for insert to authenticated
  with check ((select private.is_active_member()) and author_id = (select auth.uid()));
create policy stories_update on public.stories
  for update to authenticated
  using (author_id = (select auth.uid()) and (select private.is_active_member()))
  with check (author_id = (select auth.uid()));
create policy stories_delete on public.stories
  for delete to authenticated
  using (author_id = (select auth.uid()) and (select private.is_active_member()));

grant select on public.story_photos to authenticated;
grant insert (story_id, path, position) on public.story_photos to authenticated;
grant delete on public.story_photos to authenticated;
create policy story_photos_select on public.story_photos
  for select to authenticated
  using (exists (select 1 from public.stories s where s.id = story_id));
create policy story_photos_insert on public.story_photos
  for insert to authenticated
  with check (exists (select 1 from public.stories s
                      where s.id = story_id and s.author_id = (select auth.uid())));
create policy story_photos_delete on public.story_photos
  for delete to authenticated
  using (exists (select 1 from public.stories s
                 where s.id = story_id and s.author_id = (select auth.uid())));

grant select on public.story_comments to authenticated;
grant insert (story_id, author_id, body) on public.story_comments to authenticated;
grant delete on public.story_comments to authenticated;
create policy story_comments_select on public.story_comments
  for select to authenticated
  using (exists (select 1 from public.stories s where s.id = story_id));
create policy story_comments_insert on public.story_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.is_active_member())
    and exists (select 1 from public.stories s where s.id = story_id and not s.is_hidden)
  );
create policy story_comments_delete on public.story_comments
  for delete to authenticated
  using (
    (author_id = (select auth.uid()) and (select private.is_active_member()))
    or (select private.has_permission('stories.moderate'))
  );

-- Moderação: ocultar e reexibir (o texto não é apagado; o autor ainda vê).
create function public.story_set_hidden(p_story_id uuid, p_hidden boolean, p_reason text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.has_permission('stories.moderate') then
    raise exception 'Sem permissão para moderar' using errcode = 'insufficient_privilege';
  end if;
  update public.stories
     set is_hidden = p_hidden,
         hidden_reason = case when p_hidden then nullif(btrim(p_reason), '') else null end
   where id = p_story_id;
  if not found then
    raise exception 'História não encontrada' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Nomes de exibição para quem lê histórias e comentários.
create function public.member_names(p_ids uuid[]) returns table (id uuid, display_name text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.is_active_member() then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  return query
  select p.member_id, p.display_name from public.profiles p where p.member_id = any (p_ids);
end;
$$;

revoke execute on function public.story_set_hidden(uuid, boolean, text), public.member_names(uuid[])
  from public, anon, authenticated;
grant execute on function public.story_set_hidden(uuid, boolean, text), public.member_names(uuid[])
  to authenticated, service_role;

-- Fotos de histórias: bucket privado; só o servidor grava.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('story-media', 'story-media', false, 5242880, array['image/webp'])
on conflict (id) do nothing;

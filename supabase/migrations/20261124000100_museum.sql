-- Museu: álbuns de fotos da república ao longo dos anos.
--
-- Qualquer integrante ativo cria álbuns e envia fotos; a moderação (`stories.moderate`)
-- oculta depois. Cada álbum é público ou só de integrantes. Não há marcação de pessoas.
-- Fotos em bucket privado; o servidor grava e assina as URLs (a RLS decide quem lê).

create table public.albums (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text check (char_length(description) <= 1000),
  year smallint check (year between 1950 and 2100),
  visibility public.content_visibility not null default 'members',
  is_hidden boolean not null default false,
  hidden_reason text check (char_length(hidden_reason) <= 200),
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.albums enable row level security;
create index albums_listing_idx on public.albums (year desc nulls last, created_at desc);
create trigger albums_touch before update on public.albums
  for each row execute function private.touch_updated_at();

create table public.album_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,
  uploaded_by uuid not null references public.members (id) on delete cascade,
  path text not null check (char_length(path) <= 200),
  caption text check (char_length(caption) <= 200),
  is_hidden boolean not null default false,
  hidden_reason text check (char_length(hidden_reason) <= 200),
  created_at timestamptz not null default now()
);
alter table public.album_photos enable row level security;
create index album_photos_album_idx on public.album_photos (album_id, created_at);
create index album_photos_uploader_idx on public.album_photos (uploaded_by);

-- Auditoria: ids e ações, nunca título, legenda ou descrição.
create function private.audit_album() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.albums := case when tg_op = 'DELETE' then old else new end;
begin
  if tg_op = 'UPDATE' and old.is_hidden = new.is_hidden and old.visibility = new.visibility then
    return r;
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values ((select auth.uid()),
          case when tg_op = 'UPDATE' and old.is_hidden <> new.is_hidden
               then (case when new.is_hidden then 'hide' else 'unhide' end)
               else lower(tg_op) end,
          'albums', r.id::text, jsonb_build_object('visibility', r.visibility));
  return r;
end;
$$;
create trigger albums_audit after insert or update or delete on public.albums
  for each row execute function private.audit_album();

create function private.audit_album_photo() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.album_photos := case when tg_op = 'DELETE' then old else new end;
begin
  if tg_op = 'UPDATE' and old.is_hidden = new.is_hidden then
    return r;
  end if;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values ((select auth.uid()),
          case when tg_op = 'UPDATE' then (case when new.is_hidden then 'hide' else 'unhide' end) else lower(tg_op) end,
          'album_photos', r.id::text, jsonb_build_object('album_id', r.album_id, 'uploaded_by', r.uploaded_by));
  return r;
end;
$$;
create trigger album_photos_audit after insert or update or delete on public.album_photos
  for each row execute function private.audit_album_photo();

-- Até 100 fotos por álbum.
create function private.album_photo_limit() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.album_photos where album_id = new.album_id) >= 100 then
    raise exception 'Cada álbum aceita até 100 fotos' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger album_photos_limit before insert on public.album_photos
  for each row execute function private.album_photo_limit();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
grant select on public.albums to anon, authenticated;
grant insert (title, description, year, visibility, created_by) on public.albums to authenticated;
grant update (title, description, year, visibility) on public.albums to authenticated;
grant delete on public.albums to authenticated;

create policy albums_select_anon on public.albums
  for select to anon
  using (visibility = 'public' and not is_hidden);
create policy albums_select_auth on public.albums
  for select to authenticated
  using (
    (
      (select private.is_active_member())
      and (not is_hidden or created_by = (select auth.uid()) or (select private.has_permission('stories.moderate')))
    )
    or (visibility = 'public' and not is_hidden)
  );
create policy albums_insert on public.albums
  for insert to authenticated
  with check ((select private.is_active_member()) and created_by = (select auth.uid()));
create policy albums_update on public.albums
  for update to authenticated
  using (created_by = (select auth.uid()) and (select private.is_active_member()))
  with check (created_by = (select auth.uid()));
create policy albums_delete on public.albums
  for delete to authenticated
  using (created_by = (select auth.uid()) and (select private.is_active_member()));

grant select on public.album_photos to anon, authenticated;
grant insert (album_id, uploaded_by, path, caption) on public.album_photos to authenticated;
grant update (caption) on public.album_photos to authenticated;
grant delete on public.album_photos to authenticated;

create policy album_photos_select_anon on public.album_photos
  for select to anon
  using (
    not is_hidden
    and exists (select 1 from public.albums a where a.id = album_id and a.visibility = 'public' and not a.is_hidden)
  );
create policy album_photos_select_auth on public.album_photos
  for select to authenticated
  using (
    exists (select 1 from public.albums a where a.id = album_id)
    and (
      not is_hidden
      or uploaded_by = (select auth.uid())
      or (select private.has_permission('stories.moderate'))
    )
  );
-- Qualquer integrante ativo envia para álbum visível e não oculto.
create policy album_photos_insert on public.album_photos
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (select private.is_active_member())
    and exists (select 1 from public.albums a where a.id = album_id and not a.is_hidden)
  );
create policy album_photos_update on public.album_photos
  for update to authenticated
  using (uploaded_by = (select auth.uid()) and (select private.is_active_member()))
  with check (uploaded_by = (select auth.uid()));
-- Apaga quem enviou ou quem criou o álbum.
create policy album_photos_delete on public.album_photos
  for delete to authenticated
  using (
    (select private.is_active_member())
    and (
      uploaded_by = (select auth.uid())
      or exists (select 1 from public.albums a where a.id = album_id and a.created_by = (select auth.uid()))
    )
  );

-- Moderação: oculta ou reexibe álbum ou foto.
create function public.museum_set_hidden(p_kind text, p_id uuid, p_hidden boolean, p_reason text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_reason text := case when p_hidden then nullif(btrim(p_reason), '') else null end;
begin
  if not private.has_permission('stories.moderate') then
    raise exception 'Sem permissão para moderar' using errcode = 'insufficient_privilege';
  end if;
  if p_kind = 'album' then
    update public.albums set is_hidden = p_hidden, hidden_reason = v_reason where id = p_id;
  elsif p_kind = 'photo' then
    update public.album_photos set is_hidden = p_hidden, hidden_reason = v_reason where id = p_id;
  else
    raise exception 'Tipo inválido' using errcode = 'invalid_parameter_value';
  end if;
  if not found then
    raise exception 'Item não encontrado' using errcode = 'no_data_found';
  end if;
end;
$$;
revoke execute on function public.museum_set_hidden(text, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.museum_set_hidden(text, uuid, boolean, text) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('museum-media', 'museum-media', false, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- Storage. Caminho dos arquivos pessoais: {id-do-dono}/{tipo}/{arquivo}.
-- A política confere o primeiro segmento contra o usuário autenticado, então
-- ninguém grava na pasta de outra pessoa. Fotos de perfil seguem a mesma
-- regra de visibilidade da seção "photo"; URLs assinadas só saem para quem a
-- política de leitura permite.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('public-media', 'public-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('member-media', 'member-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create function private.try_uuid(p_text text) returns uuid
language plpgsql immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function private.try_uuid(text) to anon, authenticated, service_role;

-- member-media ---------------------------------------------------------------
create policy member_media_select on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'member-media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (
        (storage.foldername(name))[2] = 'avatar'
        and private.can_view_section(private.try_uuid((storage.foldername(name))[1]), 'photo')
      )
    )
  );

create policy member_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'member-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_active_member())
  );

create policy member_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'member-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_active_member())
  )
  with check (
    bucket_id = 'member-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy member_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'member-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- public-media ---------------------------------------------------------------
-- Leitura é livre por ser bucket público. Escrita só de conteúdo
-- institucional, por quem edita as configurações. Os módulos de eventos e
-- loja acrescentam suas próprias políticas de escrita.
create policy public_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'public-media' and (select private.has_permission('settings.manage')));

create policy public_media_update on storage.objects
  for update to authenticated
  using (bucket_id = 'public-media' and (select private.has_permission('settings.manage')))
  with check (bucket_id = 'public-media' and (select private.has_permission('settings.manage')));

create policy public_media_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'public-media' and (select private.has_permission('settings.manage')));

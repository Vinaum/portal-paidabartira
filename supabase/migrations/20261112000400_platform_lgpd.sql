-- Configurações da república, LGPD (política, consentimentos, pedidos do
-- titular), ativação de convite e criação do primeiro superadmin.

-- ---------------------------------------------------------------------------
-- Configurações
-- ---------------------------------------------------------------------------
create table public.republic_settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid references public.members (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.republic_settings enable row level security;
create trigger republic_settings_touch before update on public.republic_settings
  for each row execute function private.touch_updated_at();
create trigger republic_settings_audit
  after insert or update or delete on public.republic_settings
  for each row execute function private.audit_row_change('key');

grant select on public.republic_settings to anon, authenticated;
grant insert, update on public.republic_settings to authenticated;

create policy republic_settings_select on public.republic_settings
  for select to anon, authenticated
  using (is_public or (select private.has_permission('settings.manage')));

create policy republic_settings_insert on public.republic_settings
  for insert to authenticated
  with check ((select private.has_permission('settings.manage')));

create policy republic_settings_update on public.republic_settings
  for update to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));

-- Dados informados pela república em 11/11/2026. Os demais ficam vazios até
-- serem preenchidos no painel; a interface mostra marcadores entre colchetes.
insert into public.republic_settings (key, value, is_public) values
  ('republic.name', '"Paidabartira"', true),
  ('republic.founded_on', '"2007-03-04"', true),
  ('republic.founders_note', '"Fundada por alunos de Engenharia de Computação da turma EC06 da UNICAMP"', true),
  ('republic.history', 'null', true),
  ('republic.contact_email', 'null', true),
  ('privacy.controller_name', '"Vinicius Sartori"', true),
  ('privacy.controller_email', 'null', true);

-- ---------------------------------------------------------------------------
-- LGPD
-- ---------------------------------------------------------------------------
create table public.privacy_policy_versions (
  version text primary key check (char_length(version) <= 20),
  published_at timestamptz not null default now(),
  summary text
);
alter table public.privacy_policy_versions enable row level security;
grant select on public.privacy_policy_versions to anon, authenticated;
create policy privacy_policy_versions_select on public.privacy_policy_versions
  for select to anon, authenticated using (true);

create table public.consents (
  id bigint generated always as identity primary key,
  member_id uuid references public.members (id) on delete cascade,
  request_id uuid references public.membership_requests (id) on delete cascade,
  policy_version text not null,
  context text not null check (context in ('access_request', 'activation', 'policy_update')),
  accepted_at timestamptz not null default now(),
  constraint consents_subject_check check (member_id is not null or request_id is not null)
);
create index consents_member_idx on public.consents (member_id);
alter table public.consents enable row level security;
grant select on public.consents to authenticated;
create policy consents_select on public.consents
  for select to authenticated
  using (member_id = (select auth.uid()) or (select private.has_permission('privacy.handle')));

create type public.data_request_kind as enum ('deletion', 'correction', 'export');
create type public.data_request_status as enum ('open', 'in_progress', 'done', 'rejected');

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  kind public.data_request_kind not null,
  details text check (char_length(details) <= 2000),
  status public.data_request_status not null default 'open',
  resolution text check (char_length(resolution) <= 2000),
  handled_by uuid references public.members (id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index data_requests_status_idx on public.data_requests (status, created_at);
alter table public.data_requests enable row level security;
create trigger data_requests_audit
  after insert or update on public.data_requests
  for each row execute function private.audit_row_change('id');

grant select on public.data_requests to authenticated;
grant insert (member_id, kind, details) on public.data_requests to authenticated;
grant update (status, resolution, handled_by, handled_at) on public.data_requests to authenticated;

-- Inclusive suspensos podem pedir exclusão dos próprios dados.
create policy data_requests_insert_own on public.data_requests
  for insert to authenticated
  with check (member_id = (select auth.uid()));

create policy data_requests_select on public.data_requests
  for select to authenticated
  using (member_id = (select auth.uid()) or (select private.has_permission('privacy.handle')));

create policy data_requests_update on public.data_requests
  for update to authenticated
  using ((select private.has_permission('privacy.handle')))
  with check ((select private.has_permission('privacy.handle')));

-- Registra o aceite da política enviado junto com a solicitação de acesso.
create function private.record_request_consent() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.consents (request_id, policy_version, context)
  values (new.id, new.policy_version, 'access_request');
  return new;
end;
$$;
create trigger membership_requests_consent
  after insert on public.membership_requests
  for each row execute function private.record_request_consent();

-- ---------------------------------------------------------------------------
-- Criação do integrante (uso interno)
-- ---------------------------------------------------------------------------
create function private.create_member(
  p_user_id uuid,
  p_category public.member_category,
  p_is_founder boolean,
  p_role public.member_role,
  p_full_name text,
  p_nickname text,
  p_request_id uuid
) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.members (id, category, is_founder, role, request_id)
  values (p_user_id, p_category, p_is_founder, p_role, p_request_id);

  insert into public.profiles (member_id, full_name, display_name, nickname)
  values (
    p_user_id,
    p_full_name,
    left(coalesce(nullif(btrim(p_nickname), ''), split_part(btrim(p_full_name), ' ', 1)), 60),
    nullif(btrim(p_nickname), '')
  );

  -- Padrões conservadores: telefone e endereço começam privados.
  insert into public.profile_privacy (member_id, section, visibility) values
    (p_user_id, 'photo', 'members'),
    (p_user_id, 'emails', 'members'),
    (p_user_id, 'phone', 'private'),
    (p_user_id, 'address', 'private'),
    (p_user_id, 'professional', 'members'),
    (p_user_id, 'academic', 'members');

  insert into public.membership_history (member_id, field, new_value, changed_by)
  values (p_user_id, 'activation', p_category::text, (select auth.uid()));
end;
$$;

-- Chamada pelo próprio convidado depois de definir a senha. Não recebe
-- parâmetros: categoria, fundador e papel vêm da solicitação aprovada.
create function public.activate_membership() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invitation public.invitations;
  v_request public.membership_requests;
begin
  if v_uid is null then
    raise exception 'Sessão obrigatória' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.members where id = v_uid) then
    return;
  end if;

  select i.* into v_invitation
  from public.invitations i
  where i.auth_user_id = v_uid and i.accepted_at is null
  order by i.sent_at desc
  limit 1
  for update;
  if not found then
    raise exception 'Nenhum convite pendente para esta conta' using errcode = 'insufficient_privilege';
  end if;

  select * into v_request from public.membership_requests where id = v_invitation.request_id for update;
  if v_request.status <> 'invited' or v_request.assigned_category is null then
    raise exception 'A solicitação não está em estado de convite' using errcode = 'check_violation';
  end if;

  perform private.create_member(
    v_uid, v_request.assigned_category, v_request.assigned_is_founder, v_request.assigned_role,
    v_request.full_name, v_request.nickname, v_request.id);

  insert into public.consents (member_id, policy_version, context)
  values (v_uid, v_request.policy_version, 'activation');

  update public.invitations set accepted_at = now() where id = v_invitation.id;
  update public.membership_requests set status = 'activated' where id = v_request.id;

  perform private.log_audit('member.activate', 'members', v_uid::text,
    jsonb_build_object('request_id', v_request.id, 'category', v_request.assigned_category,
      'is_founder', v_request.assigned_is_founder, 'role', v_request.assigned_role));
end;
$$;
grant execute on function public.activate_membership() to authenticated;

-- ---------------------------------------------------------------------------
-- Primeiro superadmin. Só roda pelo SQL Editor do Supabase (papel postgres) e
-- só enquanto não existir nenhum superadmin. Ver docs/supabase.md.
-- ---------------------------------------------------------------------------
create function private.bootstrap_superadmin(
  p_email text,
  p_full_name text,
  p_category public.member_category,
  p_is_founder boolean default false,
  p_nickname text default null
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  if exists (select 1 from public.members where role = 'superadmin') then
    raise exception 'Já existe um superadmin; use o painel administrativo';
  end if;
  select id into v_uid from auth.users where lower(email) = lower(p_email);
  if v_uid is null then
    raise exception 'Crie antes o usuário % em Authentication > Users', p_email;
  end if;

  perform private.create_member(v_uid, p_category, p_is_founder, 'superadmin', p_full_name, p_nickname, null);
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (null, 'member.bootstrap_superadmin', 'members', v_uid::text, '{}'::jsonb);
  return v_uid;
end;
$$;

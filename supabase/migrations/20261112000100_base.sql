-- Fundação: esquema privado, tipos, permissões e auditoria.
-- Regra geral do projeto: toda tabela nasce com RLS ligada e sem política
-- (nega tudo). Cada acesso é liberado por política explícita.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.member_category as enum ('atual_morador', 'ex_morador', 'agregado');
create type public.member_status as enum ('active', 'suspended', 'deactivated');
create type public.member_role as enum ('membro', 'moderador', 'administrador', 'superadmin');
create type public.visibility as enum ('public', 'members', 'private');
create type public.profile_section as enum ('photo', 'emails', 'phone', 'address', 'professional', 'academic');
create type public.request_status as enum ('pending', 'needs_info', 'approved', 'invited', 'activated', 'rejected');

-- ---------------------------------------------------------------------------
-- Permissões (nomes únicos, usados também na aplicação: src/lib/permissions.ts)
-- ---------------------------------------------------------------------------
create table public.permissions (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null
);
alter table public.permissions enable row level security;

create table public.role_permissions (
  role public.member_role not null,
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role, permission),
  -- superadmin tem tudo de forma implícita; membro não recebe permissão administrativa.
  constraint role_permissions_role_check check (role in ('moderador', 'administrador'))
);
alter table public.role_permissions enable row level security;

insert into public.permissions (key, description) values
  ('members.manage', 'Gerenciar integrantes: categoria, fundador, suspensão'),
  ('members.assign_moderator', 'Atribuir ou retirar o papel de moderador'),
  ('requests.review', 'Analisar solicitações de acesso e convidar'),
  ('events.manage', 'Criar, editar, publicar e cancelar eventos'),
  ('stories.moderate', 'Aprovar, rejeitar e moderar histórias'),
  ('announcements.publish', 'Publicar comunicados'),
  ('store.manage', 'Gerenciar produtos e encomendas'),
  ('finance.write', 'Registrar lançamentos e ver comprovantes da caixinha'),
  ('settings.manage', 'Editar configurações da república'),
  ('audit.read', 'Consultar a trilha de auditoria'),
  ('privacy.handle', 'Atender pedidos de exclusão e correção de dados');

insert into public.role_permissions (role, permission) values
  ('moderador', 'events.manage'),
  ('moderador', 'stories.moderate');

insert into public.role_permissions (role, permission)
select 'administrador', key from public.permissions;

-- ---------------------------------------------------------------------------
-- Auditoria: somente inserção, e somente por funções do servidor de banco.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
alter table public.audit_logs enable row level security;

create function private.forbid_change() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Registros de % são imutáveis', tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function private.forbid_change();

create trigger audit_logs_no_truncate
  before truncate on public.audit_logs
  for each statement execute function private.forbid_change();

create function private.log_audit(
  p_action text,
  p_entity text,
  p_entity_id text,
  p_details jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values ((select auth.uid()), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- Trigger genérico para tabelas administrativas editadas diretamente.
create function private.audit_row_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(v_new ->> tg_argv[0], v_old ->> tg_argv[0]),
    jsonb_build_object('before', v_old, 'after', v_new)
  );
  return coalesce(new, old);
end;
$$;

create function private.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

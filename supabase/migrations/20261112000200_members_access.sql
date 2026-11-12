-- Integrantes, solicitações de acesso, convites e histórico de vínculo.
-- `members` guarda só o que a administração controla. O usuário comum nunca
-- grava nesta tabela: toda alteração passa por funções com checagem e auditoria.

-- ---------------------------------------------------------------------------
-- Solicitações de acesso
-- ---------------------------------------------------------------------------
create table public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 3 and 120),
  nickname text check (char_length(nickname) <= 60),
  email text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (char_length(phone) <= 30),
  relationship text not null check (char_length(relationship) between 2 and 200),
  justification text not null check (char_length(justification) between 10 and 2000),
  extra_info text check (char_length(extra_info) <= 2000),
  policy_version text not null check (char_length(policy_version) <= 20),
  status public.request_status not null default 'pending',
  assigned_category public.member_category,
  assigned_is_founder boolean not null default false,
  assigned_role public.member_role not null default 'membro',
  info_request text check (char_length(info_request) <= 2000),
  admin_notes text check (char_length(admin_notes) <= 4000),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_requests_founder_check
    check (not assigned_is_founder or assigned_category = 'ex_morador')
);
-- Uma solicitação em andamento por e-mail.
create unique index membership_requests_open_email_idx
  on public.membership_requests (lower(email))
  where status in ('pending', 'needs_info', 'approved', 'invited');
create index membership_requests_status_idx on public.membership_requests (status, created_at desc);
alter table public.membership_requests enable row level security;

create trigger membership_requests_touch
  before update on public.membership_requests
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Integrantes
-- ---------------------------------------------------------------------------
create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  category public.member_category not null,
  is_founder boolean not null default false,
  role public.member_role not null default 'membro',
  status public.member_status not null default 'active',
  joined_republic_on date,
  left_republic_on date,
  request_id uuid unique references public.membership_requests (id),
  activated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_founder_check check (not is_founder or category = 'ex_morador'),
  constraint members_dates_check
    check (left_republic_on is null or joined_republic_on is null or left_republic_on >= joined_republic_on)
);
create index members_status_category_idx on public.members (status, category);
create index members_role_idx on public.members (role) where role <> 'membro';
alter table public.members enable row level security;

create trigger members_touch
  before update on public.members
  for each row execute function private.touch_updated_at();

alter table public.membership_requests
  add constraint membership_requests_reviewed_by_fkey
  foreign key (reviewed_by) references public.members (id) on delete set null;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.membership_requests (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  invited_by uuid references public.members (id) on delete set null,
  sent_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index invitations_request_idx on public.invitations (request_id);
create index invitations_auth_user_idx on public.invitations (auth_user_id);
alter table public.invitations enable row level security;

create table public.membership_history (
  id bigint generated always as identity primary key,
  member_id uuid not null references public.members (id) on delete cascade,
  field text not null check (field in ('category', 'is_founder', 'role', 'status', 'activation')),
  old_value text,
  new_value text,
  reason text check (char_length(reason) <= 1000),
  changed_by uuid references public.members (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index membership_history_member_idx on public.membership_history (member_id, changed_at desc);
alter table public.membership_history enable row level security;

create trigger membership_history_immutable
  before update on public.membership_history
  for each row execute function private.forbid_change();

-- ---------------------------------------------------------------------------
-- Funções de autorização usadas pelas políticas.
-- Leem `members` a cada chamada: suspensão e troca de papel valem na hora.
-- ---------------------------------------------------------------------------
create function private.is_active_member() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members
    where id = (select auth.uid()) and status = 'active'
  );
$$;

create function private.member_is_active(p_member uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.members where id = p_member and status = 'active');
$$;

create function private.current_member_role() returns public.member_role
language sql stable security definer
set search_path = ''
as $$
  select role from public.members
  where id = (select auth.uid()) and status = 'active';
$$;

create function private.is_superadmin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(private.current_member_role() = 'superadmin', false);
$$;

create function private.has_permission(p_permission text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.id = (select auth.uid())
      and m.status = 'active'
      and (
        m.role = 'superadmin'
        or exists (
          select 1 from public.role_permissions rp
          where rp.role = m.role and rp.permission = p_permission
        )
      )
  );
$$;

grant execute on function
  private.is_active_member(),
  private.member_is_active(uuid),
  private.current_member_role(),
  private.is_superadmin(),
  private.has_permission(text)
to anon, authenticated, service_role;

-- Lista as permissões do usuário atual (para a interface montar menus).
create function public.my_permissions() returns setof text
language sql stable security definer
set search_path = ''
as $$
  select p.key
  from public.permissions p
  where private.has_permission(p.key);
$$;
grant execute on function public.my_permissions() to authenticated;

-- ---------------------------------------------------------------------------
-- Políticas
-- ---------------------------------------------------------------------------
grant select on public.permissions, public.role_permissions to authenticated;
grant insert, delete on public.role_permissions to authenticated;

create policy permissions_select on public.permissions
  for select to authenticated
  using ((select private.is_active_member()));

create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using ((select private.is_active_member()));

-- Só o superadmin edita a matriz, e só a do administrador.
create policy role_permissions_insert on public.role_permissions
  for insert to authenticated
  with check ((select private.is_superadmin()) and role = 'administrador');

create policy role_permissions_delete on public.role_permissions
  for delete to authenticated
  using ((select private.is_superadmin()) and role = 'administrador');

create trigger role_permissions_audit
  after insert or delete on public.role_permissions
  for each row execute function private.audit_row_change('permission');

-- members: leitura pelo próprio (mesmo suspenso, para saber seu status), por
-- membros ativos (somente outros ativos) e por quem gerencia integrantes.
grant select on public.members to authenticated;

create policy members_select on public.members
  for select to authenticated
  using (
    id = (select auth.uid())
    or (status = 'active' and (select private.is_active_member()))
    or (select private.has_permission('members.manage'))
  );

-- Solicitações: qualquer visitante insere, ninguém lê sem `requests.review`.
-- O GRANT por coluna impede que o visitante envie status, categoria ou papel.
grant insert (full_name, nickname, email, phone, relationship, justification, extra_info, policy_version)
  on public.membership_requests to anon, authenticated;
grant select on public.membership_requests to authenticated;

create policy membership_requests_insert on public.membership_requests
  for insert to anon, authenticated
  with check (status = 'pending');

create policy membership_requests_select on public.membership_requests
  for select to authenticated
  using ((select private.has_permission('requests.review')));

grant select on public.invitations to authenticated;
create policy invitations_select on public.invitations
  for select to authenticated
  using ((select private.has_permission('requests.review')));

grant select on public.membership_history to authenticated;
create policy membership_history_select on public.membership_history
  for select to authenticated
  using (
    member_id = (select auth.uid())
    or (select private.has_permission('members.manage'))
  );

grant select on public.audit_logs to authenticated;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using ((select private.has_permission('audit.read')));

-- ---------------------------------------------------------------------------
-- Operações administrativas (RPC). Todas checam permissão e auditam.
-- ---------------------------------------------------------------------------

-- Quem pode conceder cada papel: administrador e superadmin só por superadmin;
-- moderador por quem tem `members.assign_moderator`.
create function private.can_assign_role(p_role public.member_role) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case
    when p_role in ('administrador', 'superadmin') then private.is_superadmin()
    when p_role = 'moderador' then private.has_permission('members.assign_moderator')
    else private.is_active_member()
  end;
$$;

create function public.admin_review_request(
  p_request_id uuid,
  p_action text,
  p_category public.member_category default null,
  p_is_founder boolean default false,
  p_role public.member_role default 'membro',
  p_admin_notes text default null,
  p_info_request text default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_request public.membership_requests;
begin
  if not private.has_permission('requests.review') then
    raise exception 'Sem permissão para analisar solicitações' using errcode = 'insufficient_privilege';
  end if;

  select * into v_request from public.membership_requests where id = p_request_id for update;
  if not found then
    raise exception 'Solicitação não encontrada' using errcode = 'no_data_found';
  end if;
  if v_request.status not in ('pending', 'needs_info', 'approved') then
    raise exception 'Solicitação já encerrada ou convidada' using errcode = 'check_violation';
  end if;

  if p_action = 'approve' then
    if p_category is null then
      raise exception 'Categoria é obrigatória na aprovação' using errcode = 'check_violation';
    end if;
    if not private.can_assign_role(p_role) then
      raise exception 'Sem permissão para conceder o papel %', p_role using errcode = 'insufficient_privilege';
    end if;
    update public.membership_requests
      set status = 'approved',
          assigned_category = p_category,
          assigned_is_founder = coalesce(p_is_founder, false),
          assigned_role = p_role,
          admin_notes = coalesce(p_admin_notes, admin_notes),
          reviewed_by = (select auth.uid()),
          reviewed_at = now()
      where id = p_request_id;
  elsif p_action = 'reject' then
    update public.membership_requests
      set status = 'rejected',
          admin_notes = coalesce(p_admin_notes, admin_notes),
          reviewed_by = (select auth.uid()),
          reviewed_at = now()
      where id = p_request_id;
  elsif p_action = 'request_info' then
    if coalesce(btrim(p_info_request), '') = '' then
      raise exception 'Descreva a informação solicitada' using errcode = 'check_violation';
    end if;
    update public.membership_requests
      set status = 'needs_info',
          info_request = p_info_request,
          admin_notes = coalesce(p_admin_notes, admin_notes),
          reviewed_by = (select auth.uid()),
          reviewed_at = now()
      where id = p_request_id;
  elsif p_action = 'reopen' then
    update public.membership_requests
      set status = 'pending',
          admin_notes = coalesce(p_admin_notes, admin_notes)
      where id = p_request_id;
  else
    raise exception 'Ação inválida: %', p_action using errcode = 'check_violation';
  end if;

  perform private.log_audit(
    'request.' || p_action, 'membership_requests', p_request_id::text,
    jsonb_build_object('category', p_category, 'is_founder', p_is_founder, 'role', p_role)
  );
end;
$$;
grant execute on function public.admin_review_request(uuid, text, public.member_category, boolean, public.member_role, text, text)
  to authenticated;

-- Registra o convite depois que o servidor criou o usuário no Auth.
create function public.admin_register_invitation(p_request_id uuid, p_auth_user_id uuid) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_request public.membership_requests;
  v_email text;
  v_id uuid;
begin
  if not private.has_permission('requests.review') then
    raise exception 'Sem permissão para convidar' using errcode = 'insufficient_privilege';
  end if;

  select * into v_request from public.membership_requests where id = p_request_id for update;
  if not found or v_request.status not in ('approved', 'invited') then
    raise exception 'A solicitação precisa estar aprovada' using errcode = 'check_violation';
  end if;

  select email into v_email from auth.users where id = p_auth_user_id;
  if v_email is null or lower(v_email) <> lower(v_request.email) then
    raise exception 'O usuário convidado não corresponde ao e-mail da solicitação' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.members where id = p_auth_user_id) then
    raise exception 'Este usuário já é integrante' using errcode = 'unique_violation';
  end if;

  insert into public.invitations (request_id, auth_user_id, email, invited_by)
  values (p_request_id, p_auth_user_id, v_request.email, (select auth.uid()))
  returning id into v_id;

  update public.membership_requests set status = 'invited' where id = p_request_id;

  perform private.log_audit('request.invite', 'membership_requests', p_request_id::text,
    jsonb_build_object('invitation_id', v_id));
  return v_id;
end;
$$;
grant execute on function public.admin_register_invitation(uuid, uuid) to authenticated;

create function public.admin_set_member_role(
  p_member_id uuid,
  p_role public.member_role,
  p_reason text default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old public.member_role;
begin
  if p_member_id = (select auth.uid()) then
    raise exception 'Ninguém altera o próprio papel' using errcode = 'insufficient_privilege';
  end if;

  select role into v_old from public.members where id = p_member_id for update;
  if not found then
    raise exception 'Integrante não encontrado' using errcode = 'no_data_found';
  end if;

  -- É preciso poder conceder o novo papel e também "retirar" o atual.
  if not (private.can_assign_role(p_role) and private.can_assign_role(v_old))
     or not (private.is_superadmin() or private.has_permission('members.assign_moderator')) then
    raise exception 'Sem permissão para esta troca de papel' using errcode = 'insufficient_privilege';
  end if;

  if v_old = p_role then
    return;
  end if;

  update public.members set role = p_role where id = p_member_id;
  insert into public.membership_history (member_id, field, old_value, new_value, reason, changed_by)
  values (p_member_id, 'role', v_old::text, p_role::text, p_reason, (select auth.uid()));
  perform private.log_audit('member.set_role', 'members', p_member_id::text,
    jsonb_build_object('from', v_old, 'to', p_role, 'reason', p_reason));
end;
$$;
grant execute on function public.admin_set_member_role(uuid, public.member_role, text) to authenticated;

create function public.admin_update_member(
  p_member_id uuid,
  p_category public.member_category,
  p_is_founder boolean,
  p_status public.member_status,
  p_joined_republic_on date default null,
  p_left_republic_on date default null,
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
        status = p_status,
        joined_republic_on = p_joined_republic_on,
        left_republic_on = p_left_republic_on
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
grant execute on function public.admin_update_member(uuid, public.member_category, boolean, public.member_status, date, date, text)
  to authenticated;

-- Administração de integrantes e atendimento de pedidos de dados (LGPD).
--
-- As leituras administrativas são funções SECURITY DEFINER que conferem a
-- permissão logo na entrada e devolvem só as colunas que a tela precisa:
-- nada de seções privadas do perfil. As alterações passam pelas funções
-- `admin_*`, que também gravam histórico e auditoria.

-- ---------------------------------------------------------------------------
-- Lista e detalhe de integrantes (permissão members.manage)
-- ---------------------------------------------------------------------------
create function public.admin_list_members(
  p_query text default null,
  p_status public.member_status default null,
  p_category public.member_category default null,
  p_role public.member_role default null,
  p_limit integer default 30,
  p_offset integer default 0
) returns table (
  member_id uuid,
  full_name text,
  display_name text,
  category public.member_category,
  is_founder boolean,
  role public.member_role,
  status public.member_status,
  activated_at timestamptz,
  total bigint
)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_like text := private.search_pattern(p_query);
begin
  if not private.has_permission('members.manage') then
    raise exception 'Sem permissão para gerenciar integrantes' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    m.id, p.full_name, p.display_name, m.category, m.is_founder, m.role, m.status, m.activated_at,
    count(*) over ()
  from public.members m
  join public.profiles p on p.member_id = m.id
  where (p_status is null or m.status = p_status)
    and (p_category is null or m.category = p_category)
    and (p_role is null or m.role = p_role)
    and (
      v_like is null
      or private.fold(p.full_name) like v_like
      or private.fold(p.display_name) like v_like
      or private.fold(coalesce(p.nickname, '')) like v_like
    )
  order by private.fold(p.display_name), m.id
  limit greatest(1, least(coalesce(p_limit, 30), 100))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

create function public.admin_get_member(p_member_id uuid)
returns table (
  member_id uuid,
  full_name text,
  display_name text,
  login_email text,
  category public.member_category,
  is_founder boolean,
  role public.member_role,
  status public.member_status,
  activated_at timestamptz,
  open_deletion_request uuid
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.has_permission('members.manage') then
    raise exception 'Sem permissão para gerenciar integrantes' using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    m.id, p.full_name, p.display_name, u.email::text, m.category, m.is_founder, m.role, m.status, m.activated_at,
    (select d.id from public.data_requests d
      where d.member_id = m.id and d.kind = 'deletion' and d.status in ('open', 'in_progress') limit 1)
  from public.members m
  join public.profiles p on p.member_id = m.id
  join auth.users u on u.id = m.id
  where m.id = p_member_id;
end;
$$;

create function public.admin_member_history(p_member_id uuid)
returns table (
  field text,
  old_value text,
  new_value text,
  reason text,
  changed_at timestamptz,
  changed_by_name text
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.has_permission('members.manage') then
    raise exception 'Sem permissão para gerenciar integrantes' using errcode = 'insufficient_privilege';
  end if;

  return query
  select h.field, h.old_value, h.new_value, h.reason, h.changed_at, p.display_name
  from public.membership_history h
  left join public.profiles p on p.member_id = h.changed_by
  where h.member_id = p_member_id
  order by h.changed_at desc, h.id desc
  limit 100;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pedidos de dados (permissão privacy.handle)
-- ---------------------------------------------------------------------------
-- O gatilho genérico gravava a linha inteira na auditoria, inclusive o texto
-- livre do pedido e da resposta. A auditoria é imutável e sobrevive à exclusão
-- da conta, então passa a registrar só o que é necessário para provar o fluxo.
drop trigger data_requests_audit on public.data_requests;
create function private.audit_data_request() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()),
    lower(tg_op),
    'data_requests',
    new.id::text,
    jsonb_build_object(
      'kind', new.kind,
      'status', new.status,
      'before_status', case when tg_op = 'UPDATE' then old.status end
    )
  );
  return new;
end;
$$;
create trigger data_requests_audit
  after insert or update on public.data_requests
  for each row execute function private.audit_data_request();

-- Quem atende pedidos passa pela função abaixo (que preenche responsável e data
-- no servidor); a atualização direta da tabela deixa de existir.
revoke update on public.data_requests from authenticated;
drop policy data_requests_update on public.data_requests;

create function public.admin_list_data_requests(p_status public.data_request_status default null)
returns table (
  id uuid,
  member_id uuid,
  member_name text,
  member_role public.member_role,
  member_status public.member_status,
  kind public.data_request_kind,
  details text,
  status public.data_request_status,
  resolution text,
  handled_by_name text,
  handled_at timestamptz,
  created_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.has_permission('privacy.handle') then
    raise exception 'Sem permissão para atender pedidos de dados' using errcode = 'insufficient_privilege';
  end if;

  return query
  select d.id, d.member_id, p.display_name, m.role, m.status, d.kind, d.details, d.status, d.resolution,
         hp.display_name, d.handled_at, d.created_at
  from public.data_requests d
  join public.members m on m.id = d.member_id
  join public.profiles p on p.member_id = d.member_id
  left join public.profiles hp on hp.member_id = d.handled_by
  where p_status is null or d.status = p_status
  order by (d.status in ('open', 'in_progress')) desc, d.created_at desc
  limit 200;
end;
$$;

create function public.admin_resolve_data_request(
  p_request_id uuid,
  p_status public.data_request_status,
  p_resolution text default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old public.data_request_status;
begin
  if not private.has_permission('privacy.handle') then
    raise exception 'Sem permissão para atender pedidos de dados' using errcode = 'insufficient_privilege';
  end if;
  if p_status = 'open' then
    raise exception 'Um pedido atendido não volta a "aberto"' using errcode = 'check_violation';
  end if;
  if p_status in ('done', 'rejected') and nullif(btrim(p_resolution), '') is null then
    raise exception 'Informe a resposta dada ao titular' using errcode = 'check_violation';
  end if;

  select status into v_old from public.data_requests where id = p_request_id for update;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'no_data_found';
  end if;
  if v_old in ('done', 'rejected') then
    raise exception 'Pedido já encerrado' using errcode = 'check_violation';
  end if;

  update public.data_requests
    set status = p_status,
        resolution = nullif(btrim(p_resolution), ''),
        handled_by = (select auth.uid()),
        handled_at = now()
    where id = p_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Exclusão de conta (executa o pedido do titular). Em três passos, porque o
-- Auth só se apaga pela API: begin (valida e limpa a solicitação de acesso) ->
-- servidor apaga arquivos e o usuário no Auth (o resto cai em cascata) ->
-- finish (confere e registra).
-- ---------------------------------------------------------------------------
-- A solicitação de acesso guarda nome, e-mail e telefone. Ao apagá-la, o
-- vínculo do integrante apenas perde a referência.
alter table public.members drop constraint members_request_id_fkey;
alter table public.members
  add constraint members_request_id_fkey
  foreign key (request_id) references public.membership_requests (id) on delete set null;

create function public.admin_begin_account_deletion(p_request_id uuid) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_req public.data_requests;
  v_target public.members;
begin
  if not private.has_permission('privacy.handle') then
    raise exception 'Sem permissão para atender pedidos de dados' using errcode = 'insufficient_privilege';
  end if;

  select * into v_req from public.data_requests where id = p_request_id for update;
  if not found or v_req.kind <> 'deletion' or v_req.status not in ('open', 'in_progress') then
    raise exception 'Não há pedido de exclusão em andamento com este código' using errcode = 'check_violation';
  end if;

  select * into v_target from public.members where id = v_req.member_id for update;
  if v_target.id = (select auth.uid()) then
    raise exception 'Você não executa a exclusão da própria conta' using errcode = 'insufficient_privilege';
  end if;
  if v_target.role = 'superadmin' then
    raise exception 'A conta de superadmin não é excluída por aqui' using errcode = 'insufficient_privilege';
  end if;
  if v_target.role = 'administrador' and not private.is_superadmin() then
    raise exception 'Somente o superadmin exclui um administrador' using errcode = 'insufficient_privilege';
  end if;

  if v_target.request_id is not null then
    delete from public.membership_requests where id = v_target.request_id;
  end if;

  update public.data_requests
    set status = 'in_progress', handled_by = (select auth.uid()), handled_at = now()
    where id = p_request_id;

  perform private.log_audit('privacy.account_deletion_started', 'members', v_target.id::text,
    jsonb_build_object('data_request_id', p_request_id, 'role', v_target.role, 'category', v_target.category));
  return v_target.id;
end;
$$;

create function public.admin_finish_account_deletion(p_member_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.has_permission('privacy.handle') then
    raise exception 'Sem permissão para atender pedidos de dados' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from public.members where id = p_member_id) then
    raise exception 'A conta ainda existe' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.audit_logs
    where action = 'privacy.account_deletion_started'
      and entity_id = p_member_id::text
      and actor_id = (select auth.uid())
  ) then
    raise exception 'Exclusão não iniciada por você' using errcode = 'insufficient_privilege';
  end if;

  perform private.log_audit('privacy.account_deleted', 'members', p_member_id::text, '{}'::jsonb);
end;
$$;

-- Funções administrativas: só usuários autenticados executam; a checagem de
-- permissão está dentro de cada uma.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_list_members(text, public.member_status, public.member_category, public.member_role, integer, integer)',
    'admin_get_member(uuid)',
    'admin_member_history(uuid)',
    'admin_list_data_requests(public.data_request_status)',
    'admin_resolve_data_request(uuid, public.data_request_status, text)',
    'admin_begin_account_deletion(uuid)',
    'admin_finish_account_deletion(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end $$;

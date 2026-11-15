-- Associação: grupo de ex-moradores e agregados que apoia a república.
--
-- O que existe
--   * adesão por aprovação: um integrante ATIVO que seja ex-morador ou agregado
--     pede para entrar; quem tem `association.manage` aprova ou recusa;
--   * mensalidades por PIX com conferência manual: o associado informa que pagou,
--     a gestão confirma (o que lança uma entrada no livro-caixa) ou recusa;
--   * transparência: associados veem totais, fluxo por mês e cada saída; quem
--     contribuiu nunca aparece no livro-caixa (a ligação fica só em `association_dues`,
--     visível ao próprio associado e à gestão);
--   * documentos (estatuto, atas, prestação de contas) em PDF, em bucket privado.
--
-- Regras de dinheiro (iguais às da caixinha): centavos inteiros; livro-caixa imutável,
-- com erro corrigido por estorno; saldo nunca negativo.
--
-- Quem vê o quê
--   * visitante e integrante comum: nada (só o próprio pedido de adesão);
--   * associado ativo: resumo, saídas, documentos, dados do PIX e as próprias mensalidades;
--   * `association.manage` (administrador e superadmin; atribuível a moderador pela
--     tela de permissões): tudo, inclusive a lista de associados e as mensalidades.

insert into public.permissions (key, description) values
  ('association.manage', 'Gerenciar a Associação: adesões, mensalidades, livro-caixa e documentos');
insert into public.role_permissions (role, permission) values ('administrador', 'association.manage');

create type public.association_status as enum ('pending', 'active', 'declined', 'left');
create type public.association_due_status as enum ('informed', 'confirmed', 'rejected');
create type public.association_doc_kind as enum ('estatuto', 'ata', 'prestacao_contas', 'outro');

-- ---------------------------------------------------------------------------
-- Associados
-- ---------------------------------------------------------------------------
create table public.association_members (
  member_id uuid primary key references public.members (id) on delete cascade,
  status public.association_status not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_by uuid references public.members (id) on delete set null,
  decided_at timestamptz,
  joined_on date,
  updated_at timestamptz not null default now()
);
create index association_members_status_idx on public.association_members (status, requested_at);
alter table public.association_members enable row level security;
create trigger association_members_touch before update on public.association_members
  for each row execute function private.touch_updated_at();

-- Configuração única (linha única): dados do PIX e valor sugerido da mensalidade.
create table public.association_settings (
  id boolean primary key default true check (id),
  pix_key text check (char_length(pix_key) <= 140),
  pix_holder text check (char_length(pix_holder) <= 80),
  pix_instructions text check (char_length(pix_instructions) <= 500),
  monthly_cents bigint check (monthly_cents > 0 and monthly_cents <= 100000000),
  updated_by uuid references public.members (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.association_settings (id) values (true);
alter table public.association_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Livro-caixa (imutável)
-- ---------------------------------------------------------------------------
create table public.association_ledger (
  id uuid primary key default gen_random_uuid(),
  kind public.ledger_kind not null,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  occurred_on date not null,
  category text check (char_length(category) between 2 and 40),
  description text not null check (char_length(btrim(description)) between 3 and 200),
  reverses_id uuid unique references public.association_ledger (id) on delete restrict,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index association_ledger_date_idx on public.association_ledger (occurred_on desc);
alter table public.association_ledger enable row level security;

create function private.association_ledger_immutable() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Única alteração aceita: o banco zera `created_by` quando a conta é excluída (LGPD).
  if tg_op = 'UPDATE'
     and new.created_by is null
     and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then
    return new;
  end if;
  raise exception 'Lançamentos são imutáveis; corrija com um estorno' using errcode = 'restrict_violation';
end;
$$;
create trigger association_ledger_immutable
  before update or delete on public.association_ledger
  for each row execute function private.association_ledger_immutable();
create trigger association_ledger_no_truncate
  before truncate on public.association_ledger
  for each statement execute function private.forbid_change();

create function private.association_ledger_guard() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_orig public.association_ledger;
  v_balance bigint;
  v_effect bigint;
begin
  -- Serializa lançamentos simultâneos.
  perform 1 from public.association_settings where id for update;

  if new.reverses_id is not null then
    select * into v_orig from public.association_ledger where id = new.reverses_id;
    if not found
       or v_orig.reverses_id is not null
       or v_orig.kind <> new.kind
       or v_orig.amount_cents <> new.amount_cents then
      raise exception 'Estorno inválido: deve repetir tipo e valor do lançamento original'
        using errcode = 'check_violation';
    end if;
  end if;

  v_effect := new.amount_cents
    * case when new.kind = 'income' then 1 else -1 end
    * case when new.reverses_id is null then 1 else -1 end;
  select coalesce(sum(
    amount_cents
      * case when kind = 'income' then 1 else -1 end
      * case when reverses_id is null then 1 else -1 end), 0)
    into v_balance from public.association_ledger;
  if v_balance + v_effect < 0 then
    raise exception 'Saldo insuficiente na Associação' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger association_ledger_guard
  before insert on public.association_ledger
  for each row execute function private.association_ledger_guard();

-- ---------------------------------------------------------------------------
-- Mensalidades
-- ---------------------------------------------------------------------------
create table public.association_dues (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  ref_month date not null check (ref_month = date_trunc('month', ref_month)::date),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000),
  status public.association_due_status not null default 'informed',
  informed_at timestamptz not null default now(),
  decided_by uuid references public.members (id) on delete set null,
  decided_at timestamptz,
  ledger_entry_id uuid unique references public.association_ledger (id) on delete restrict
);
-- Um mês por associado, enquanto não recusado.
create unique index association_dues_month_idx
  on public.association_dues (member_id, ref_month) where status <> 'rejected';
create index association_dues_status_idx on public.association_dues (status, informed_at);
alter table public.association_dues enable row level security;

-- ---------------------------------------------------------------------------
-- Documentos
-- ---------------------------------------------------------------------------
create table public.association_documents (
  id uuid primary key default gen_random_uuid(),
  kind public.association_doc_kind not null,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text check (char_length(description) <= 500),
  doc_date date not null,
  path text not null unique check (char_length(path) <= 200 and path ~ '^[a-z0-9/_-]+\.pdf$'),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 8388608),
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index association_documents_date_idx on public.association_documents (doc_date desc);
alter table public.association_documents enable row level security;

-- ---------------------------------------------------------------------------
-- Autorização
-- ---------------------------------------------------------------------------
create function private.is_associate() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.association_members am
    join public.members m on m.id = am.member_id
    where am.member_id = (select auth.uid()) and am.status = 'active' and m.status = 'active'
  )
$$;

create function private.can_manage_association() returns boolean
language sql stable security definer
set search_path = ''
as $$ select private.has_permission('association.manage') $$;

create function private.can_see_association() returns boolean
language sql stable security definer
set search_path = ''
as $$ select private.is_associate() or private.can_manage_association() $$;

revoke execute on function private.is_associate(), private.can_manage_association(), private.can_see_association()
  from public, anon;
grant execute on function private.is_associate(), private.can_manage_association(), private.can_see_association()
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Leitura direta (a RLS decide); escrita só pelas funções abaixo
-- ---------------------------------------------------------------------------
grant select on public.association_members, public.association_dues,
  public.association_ledger, public.association_documents to authenticated;

create policy association_members_select on public.association_members
  for select to authenticated
  using (member_id = (select auth.uid()) or (select private.can_manage_association()));
create policy association_dues_select on public.association_dues
  for select to authenticated
  using (member_id = (select auth.uid()) or (select private.can_manage_association()));
create policy association_ledger_select on public.association_ledger
  for select to authenticated
  using ((select private.can_manage_association()));
create policy association_documents_select on public.association_documents
  for select to authenticated
  using ((select private.can_see_association()));
-- association_settings: sem política nem GRANT; só as funções leem e gravam.

-- ---------------------------------------------------------------------------
-- Adesão
-- ---------------------------------------------------------------------------
create function public.association_apply() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_category public.member_category;
  v_status public.association_status;
begin
  select category into v_category from public.members
    where id = (select auth.uid()) and status = 'active';
  if not found then
    raise exception 'Apenas integrantes ativos podem pedir adesão' using errcode = 'insufficient_privilege';
  end if;
  if v_category = 'atual_morador' then
    raise exception 'Moradores atuais participam como integrantes; a Associação é para ex-moradores e agregados'
      using errcode = 'check_violation';
  end if;

  select status into v_status from public.association_members where member_id = (select auth.uid());
  if found and v_status in ('pending', 'active') then
    raise exception 'Você já tem um pedido de adesão em andamento ou já é associado'
      using errcode = 'check_violation';
  end if;

  insert into public.association_members (member_id) values ((select auth.uid()))
  on conflict (member_id) do update
    set status = 'pending', requested_at = now(), decided_by = null, decided_at = null;

  perform private.log_audit('association.apply', 'association_members', (select auth.uid())::text);
end;
$$;

create function public.association_decide(p_member_id uuid, p_status public.association_status)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_current public.association_status;
begin
  if not private.can_manage_association() then
    raise exception 'Sem permissão para gerenciar a Associação' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('active', 'declined', 'left') then
    raise exception 'Situação inválida' using errcode = 'check_violation';
  end if;

  select status into v_current from public.association_members where member_id = p_member_id for update;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'no_data_found';
  end if;
  if (p_status = 'declined' and v_current <> 'pending')
     or (p_status = 'left' and v_current <> 'active')
     or (p_status = 'active' and v_current = 'active') then
    raise exception 'Essa mudança de situação não é permitida' using errcode = 'check_violation';
  end if;
  if p_status = 'active' and not private.member_is_active(p_member_id) then
    raise exception 'O integrante não está ativo' using errcode = 'check_violation';
  end if;

  update public.association_members
     set status = p_status, decided_by = (select auth.uid()), decided_at = now(),
         joined_on = case when p_status = 'active' then coalesce(joined_on, private.brt_today()) else joined_on end
   where member_id = p_member_id;

  perform private.log_audit('association.' || p_status::text, 'association_members', p_member_id::text);
end;
$$;

create function public.association_list_members()
returns table (member_id uuid, display_name text, category public.member_category,
               status public.association_status, requested_at timestamptz, joined_on date)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.can_manage_association() then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  return query
  select am.member_id, p.display_name, m.category, am.status, am.requested_at, am.joined_on
  from public.association_members am
  join public.members m on m.id = am.member_id
  join public.profiles p on p.member_id = am.member_id
  order by (am.status = 'pending') desc, p.display_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mensalidades
-- ---------------------------------------------------------------------------
create function public.association_inform_due(p_month date, p_amount_cents bigint) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_id uuid;
begin
  if not private.is_associate() then
    raise exception 'Só associados informam mensalidades' using errcode = 'insufficient_privilege';
  end if;
  if v_month > date_trunc('month', private.brt_today())::date then
    raise exception 'Não é possível informar um mês futuro' using errcode = 'check_violation';
  end if;
  if v_month < date '2007-03-01' then
    raise exception 'Mês inválido' using errcode = 'check_violation';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000000 then
    raise exception 'Valor inválido' using errcode = 'check_violation';
  end if;

  begin
    insert into public.association_dues (member_id, ref_month, amount_cents)
    values ((select auth.uid()), v_month, p_amount_cents)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Esse mês já foi informado' using errcode = 'check_violation';
  end;

  perform private.log_audit('association.due_informed', 'association_dues', v_id::text,
    jsonb_build_object('amount_cents', p_amount_cents));
  return v_id;
end;
$$;

create function public.association_decide_due(p_due_id uuid, p_confirm boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_due public.association_dues;
  v_entry uuid;
begin
  if not private.can_manage_association() then
    raise exception 'Sem permissão para gerenciar a Associação' using errcode = 'insufficient_privilege';
  end if;
  select * into v_due from public.association_dues where id = p_due_id for update;
  if not found then
    raise exception 'Mensalidade não encontrada' using errcode = 'no_data_found';
  end if;
  if v_due.status <> 'informed' then
    raise exception 'Essa mensalidade já foi analisada' using errcode = 'check_violation';
  end if;

  if p_confirm then
    -- A descrição não leva o nome de quem pagou.
    insert into public.association_ledger (kind, amount_cents, occurred_on, category, description, created_by)
    values ('income', v_due.amount_cents, private.brt_today(), 'Mensalidade',
            'Mensalidade ' || to_char(v_due.ref_month, 'MM/YYYY'), (select auth.uid()))
    returning id into v_entry;
  end if;

  update public.association_dues
     set status = case when p_confirm then 'confirmed' else 'rejected' end::public.association_due_status,
         decided_by = (select auth.uid()), decided_at = now(), ledger_entry_id = v_entry
   where id = p_due_id;

  perform private.log_audit(
    case when p_confirm then 'association.due_confirmed' else 'association.due_rejected' end,
    'association_dues', p_due_id::text, jsonb_build_object('amount_cents', v_due.amount_cents));
end;
$$;

create function public.association_list_dues(p_status public.association_due_status default null,
                                             p_limit integer default 50)
returns table (id uuid, member_id uuid, display_name text, ref_month date, amount_cents bigint,
               status public.association_due_status, informed_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.can_manage_association() then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  return query
  select d.id, d.member_id, p.display_name, d.ref_month, d.amount_cents, d.status, d.informed_at
  from public.association_dues d
  join public.profiles p on p.member_id = d.member_id
  where p_status is null or d.status = p_status
  order by (d.status = 'informed') desc, d.informed_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

-- ---------------------------------------------------------------------------
-- Livro-caixa: lançar e estornar (gestão)
-- ---------------------------------------------------------------------------
create function public.association_add_entry(
  p_kind public.ledger_kind, p_amount_cents bigint, p_occurred_on date,
  p_category text, p_description text
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_manage_association() then
    raise exception 'Sem permissão para lançar' using errcode = 'insufficient_privilege';
  end if;
  if p_occurred_on > private.brt_today() then
    raise exception 'A data do lançamento não pode ser futura' using errcode = 'check_violation';
  end if;
  insert into public.association_ledger (kind, amount_cents, occurred_on, category, description, created_by)
  values (p_kind, p_amount_cents, p_occurred_on, nullif(btrim(p_category), ''), btrim(p_description),
          (select auth.uid()))
  returning id into v_id;
  perform private.log_audit('association.entry_added', 'association_ledger', v_id::text,
    jsonb_build_object('kind', p_kind, 'amount_cents', p_amount_cents));
  return v_id;
end;
$$;

create function public.association_reverse_entry(p_entry_id uuid, p_reason text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_orig public.association_ledger;
  v_id uuid;
begin
  if not private.can_manage_association() then
    raise exception 'Sem permissão para lançar' using errcode = 'insufficient_privilege';
  end if;
  select * into v_orig from public.association_ledger where id = p_entry_id;
  if not found then
    raise exception 'Lançamento não encontrado' using errcode = 'no_data_found';
  end if;
  if nullif(btrim(p_reason), '') is null or char_length(btrim(p_reason)) > 160 then
    raise exception 'Informe o motivo do estorno (até 160 caracteres)' using errcode = 'check_violation';
  end if;

  insert into public.association_ledger (kind, amount_cents, occurred_on, category, description, reverses_id, created_by)
  values (v_orig.kind, v_orig.amount_cents, private.brt_today(), v_orig.category,
          'Estorno: ' || btrim(p_reason), v_orig.id, (select auth.uid()))
  returning id into v_id;

  -- Mensalidade que originou a entrada volta a poder ser informada.
  update public.association_dues set status = 'rejected'
   where ledger_entry_id = p_entry_id and status = 'confirmed';

  perform private.log_audit('association.entry_reversed', 'association_ledger', v_id::text,
    jsonb_build_object('reverses_id', v_orig.id, 'amount_cents', v_orig.amount_cents));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Transparência (associados e gestão), sem nomes de quem contribuiu
-- ---------------------------------------------------------------------------
create function public.association_summary()
returns table (raised_cents bigint, spent_cents bigint, balance_cents bigint, associates bigint)
language sql stable security definer
set search_path = ''
as $$
  with t as (
    select
      coalesce(sum(amount_cents * case when reverses_id is null then 1 else -1 end)
               filter (where kind = 'income'), 0) as raised,
      coalesce(sum(amount_cents * case when reverses_id is null then 1 else -1 end)
               filter (where kind = 'expense'), 0) as spent
    from public.association_ledger
  )
  select t.raised::bigint, t.spent::bigint, (t.raised - t.spent)::bigint,
         (select count(*) from public.association_members where status = 'active')
  from t
  where (select private.can_see_association())
$$;

create function public.association_cashflow()
returns table (month date, income_cents bigint, expense_cents bigint)
language sql stable security definer
set search_path = ''
as $$
  select
    date_trunc('month', l.occurred_on)::date,
    coalesce(sum(l.amount_cents * case when l.reverses_id is null then 1 else -1 end)
             filter (where l.kind = 'income'), 0)::bigint,
    coalesce(sum(l.amount_cents * case when l.reverses_id is null then 1 else -1 end)
             filter (where l.kind = 'expense'), 0)::bigint
  from public.association_ledger l
  where (select private.can_see_association())
  group by 1
  order by 1 desc
  limit 60
$$;

create function public.association_expenses(p_limit integer default 50, p_offset integer default 0)
returns table (id uuid, occurred_on date, category text, description text, amount_cents bigint,
               is_reversal boolean, total bigint)
language sql stable security definer
set search_path = ''
as $$
  select l.id, l.occurred_on, l.category, l.description, l.amount_cents, l.reverses_id is not null,
         count(*) over ()
  from public.association_ledger l
  where l.kind = 'expense' and (select private.can_see_association())
  order by l.occurred_on desc, l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(0, coalesce(p_offset, 0))
$$;

-- ---------------------------------------------------------------------------
-- Configuração do PIX
-- ---------------------------------------------------------------------------
create function public.association_get_settings()
returns table (pix_key text, pix_holder text, pix_instructions text, monthly_cents bigint)
language sql stable security definer
set search_path = ''
as $$
  select s.pix_key, s.pix_holder, s.pix_instructions, s.monthly_cents
  from public.association_settings s
  where (select private.can_see_association())
$$;

create function public.association_save_settings(
  p_pix_key text, p_pix_holder text, p_pix_instructions text, p_monthly_cents bigint
) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.can_manage_association() then
    raise exception 'Sem permissão para gerenciar a Associação' using errcode = 'insufficient_privilege';
  end if;
  update public.association_settings
     set pix_key = nullif(btrim(p_pix_key), ''),
         pix_holder = nullif(btrim(p_pix_holder), ''),
         pix_instructions = nullif(btrim(p_pix_instructions), ''),
         monthly_cents = p_monthly_cents,
         updated_by = (select auth.uid()), updated_at = now()
   where id;
  -- A chave PIX pode ser CPF ou telefone: não vai para a auditoria.
  perform private.log_audit('association.settings_saved', 'association_settings', 'singleton',
    jsonb_build_object('monthly_cents', p_monthly_cents));
end;
$$;

-- ---------------------------------------------------------------------------
-- Documentos
-- ---------------------------------------------------------------------------
create function public.association_add_document(
  p_kind public.association_doc_kind, p_title text, p_description text,
  p_doc_date date, p_path text, p_size_bytes integer
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_manage_association() then
    raise exception 'Sem permissão para gerenciar a Associação' using errcode = 'insufficient_privilege';
  end if;
  insert into public.association_documents (kind, title, description, doc_date, path, size_bytes, created_by)
  values (p_kind, btrim(p_title), nullif(btrim(p_description), ''), p_doc_date, p_path, p_size_bytes,
          (select auth.uid()))
  returning id into v_id;
  perform private.log_audit('association.document_added', 'association_documents', v_id::text,
    jsonb_build_object('kind', p_kind));
  return v_id;
end;
$$;

-- Devolve o caminho no storage para o servidor apagar o arquivo.
create function public.association_remove_document(p_id uuid) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  if not private.can_manage_association() then
    raise exception 'Sem permissão para gerenciar a Associação' using errcode = 'insufficient_privilege';
  end if;
  delete from public.association_documents where id = p_id returning path into v_path;
  if not found then
    raise exception 'Documento não encontrado' using errcode = 'no_data_found';
  end if;
  perform private.log_audit('association.document_removed', 'association_documents', p_id::text);
  return v_path;
end;
$$;

revoke execute on function
  public.association_apply(),
  public.association_decide(uuid, public.association_status),
  public.association_list_members(),
  public.association_inform_due(date, bigint),
  public.association_decide_due(uuid, boolean),
  public.association_list_dues(public.association_due_status, integer),
  public.association_add_entry(public.ledger_kind, bigint, date, text, text),
  public.association_reverse_entry(uuid, text),
  public.association_summary(),
  public.association_cashflow(),
  public.association_expenses(integer, integer),
  public.association_get_settings(),
  public.association_save_settings(text, text, text, bigint),
  public.association_add_document(public.association_doc_kind, text, text, date, text, integer),
  public.association_remove_document(uuid)
  from public, anon, authenticated;

grant execute on function
  public.association_apply(),
  public.association_decide(uuid, public.association_status),
  public.association_list_members(),
  public.association_inform_due(date, bigint),
  public.association_decide_due(uuid, boolean),
  public.association_list_dues(public.association_due_status, integer),
  public.association_add_entry(public.ledger_kind, bigint, date, text, text),
  public.association_reverse_entry(uuid, text),
  public.association_summary(),
  public.association_cashflow(),
  public.association_expenses(integer, integer),
  public.association_get_settings(),
  public.association_save_settings(text, text, text, bigint),
  public.association_add_document(public.association_doc_kind, text, text, date, text, integer),
  public.association_remove_document(uuid)
  to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('association-media', 'association-media', false, 8388608, array['application/pdf'])
on conflict (id) do nothing;

-- Caixinha: várias caixinhas, livro-caixa imutável e transparência sem expor doadores.
--
-- Regras de dinheiro
--   * valores em centavos (inteiros); nada de ponto flutuante;
--   * o livro-caixa não se altera nem se apaga: erro se corrige com um estorno,
--     que é um novo lançamento ligado ao original (`reverses_id`);
--   * o saldo de uma caixinha nunca fica negativo.
--
-- Quem vê o quê
--   * visitante: só caixinhas públicas, com total arrecadado e meta;
--   * integrante ativo: totais, fluxo de caixa por mês e cada saída, de caixinhas
--     públicas e de integrantes;
--   * entradas individuais (e qualquer nome ligado a elas) só para quem lança:
--     quem tem `finance.write` (administrador e superadmin) e os responsáveis
--     designados por caixinha. O sistema não guarda quem contribuiu.

create type public.fund_visibility as enum ('public', 'members');
create type public.ledger_kind as enum ('income', 'expense');

create table public.funds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 80),
  description text check (char_length(description) <= 1000),
  goal_cents bigint check (goal_cents > 0 and goal_cents <= 100000000000),
  visibility public.fund_visibility not null default 'members',
  pix_key text check (char_length(pix_key) <= 140),
  pix_holder text check (char_length(pix_holder) <= 80),
  pix_instructions text check (char_length(pix_instructions) <= 500),
  is_active boolean not null default true,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.funds enable row level security;
create trigger funds_touch before update on public.funds
  for each row execute function private.touch_updated_at();

-- A auditoria da caixinha não leva a chave PIX (pode ser CPF ou telefone).
create function private.audit_fund() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()), lower(tg_op), 'funds', new.id::text,
    jsonb_build_object('name', new.name, 'visibility', new.visibility, 'is_active', new.is_active,
                       'goal_cents', new.goal_cents)
  );
  return new;
end;
$$;
create trigger funds_audit after insert or update on public.funds
  for each row execute function private.audit_fund();

create table public.fund_managers (
  fund_id uuid not null references public.funds (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  added_by uuid references public.members (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (fund_id, member_id)
);
create index fund_managers_member_idx on public.fund_managers (member_id);
alter table public.fund_managers enable row level security;

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds (id) on delete restrict,
  kind public.ledger_kind not null,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  occurred_on date not null,
  category text check (char_length(category) between 2 and 40),
  description text not null check (char_length(btrim(description)) between 3 and 200),
  reverses_id uuid unique references public.ledger_entries (id) on delete restrict,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ledger_entries_fund_date_idx on public.ledger_entries (fund_id, occurred_on desc);
alter table public.ledger_entries enable row level security;

-- Imutável. A única alteração aceita é a que o banco faz sozinho quando uma
-- conta é excluída (LGPD): `created_by` vira nulo. Nada mais muda.
create function private.ledger_immutable() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.created_by is null
     and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then
    return new;
  end if;
  raise exception 'Lançamentos são imutáveis; corrija com um estorno' using errcode = 'restrict_violation';
end;
$$;
create trigger ledger_entries_immutable
  before update or delete on public.ledger_entries
  for each row execute function private.ledger_immutable();
create trigger ledger_entries_no_truncate
  before truncate on public.ledger_entries
  for each statement execute function private.forbid_change();

-- Impede saldo negativo e confere o estorno. A caixinha é travada para que dois
-- lançamentos simultâneos não passem juntos.
create function private.ledger_guard() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_orig public.ledger_entries;
  v_balance bigint;
  v_effect bigint;
begin
  perform 1 from public.funds where id = new.fund_id for update;

  if new.reverses_id is not null then
    select * into v_orig from public.ledger_entries where id = new.reverses_id;
    if not found
       or v_orig.reverses_id is not null
       or v_orig.fund_id <> new.fund_id
       or v_orig.kind <> new.kind
       or v_orig.amount_cents <> new.amount_cents then
      raise exception 'Estorno inválido: deve repetir caixinha, tipo e valor do lançamento original'
        using errcode = 'check_violation';
    end if;
  end if;

  -- efeito no saldo: entrada soma, saída subtrai; estorno inverte.
  v_effect := new.amount_cents
    * case when new.kind = 'income' then 1 else -1 end
    * case when new.reverses_id is null then 1 else -1 end;

  select coalesce(sum(
    amount_cents
      * case when kind = 'income' then 1 else -1 end
      * case when reverses_id is null then 1 else -1 end), 0)
    into v_balance
    from public.ledger_entries where fund_id = new.fund_id;

  if v_balance + v_effect < 0 then
    raise exception 'Saldo insuficiente na caixinha' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger ledger_entries_guard
  before insert on public.ledger_entries
  for each row execute function private.ledger_guard();

-- ---------------------------------------------------------------------------
-- Autorização
-- ---------------------------------------------------------------------------
create function private.can_manage_fund(p_fund_id uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.has_permission('finance.write')
    or exists (
      select 1
      from public.fund_managers fm
      join public.members m on m.id = fm.member_id
      where fm.fund_id = p_fund_id
        and fm.member_id = (select auth.uid())
        and m.status = 'active'
    )
$$;

create function private.brt_today() returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

revoke execute on function private.can_manage_fund(uuid), private.brt_today() from public, anon;
grant execute on function private.can_manage_fund(uuid), private.brt_today() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tabelas: só quem gerencia lê direto; escrita de lançamentos e de responsáveis
-- passa pelas funções abaixo.
-- ---------------------------------------------------------------------------
grant select on public.funds to authenticated;
grant insert (name, description, goal_cents, visibility, pix_key, pix_holder, pix_instructions, is_active, created_by)
  on public.funds to authenticated;
grant update (name, description, goal_cents, visibility, pix_key, pix_holder, pix_instructions, is_active)
  on public.funds to authenticated;

create policy funds_select_managers on public.funds
  for select to authenticated
  using ((select private.can_manage_fund(id)));
create policy funds_insert on public.funds
  for insert to authenticated
  with check ((select private.has_permission('finance.write')) and created_by = (select auth.uid()));
create policy funds_update on public.funds
  for update to authenticated
  using ((select private.has_permission('finance.write')))
  with check ((select private.has_permission('finance.write')));

grant select on public.fund_managers to authenticated;
create policy fund_managers_select on public.fund_managers
  for select to authenticated
  using ((select private.has_permission('finance.write')) or member_id = (select auth.uid()));

grant select on public.ledger_entries to authenticated;
create policy ledger_entries_select on public.ledger_entries
  for select to authenticated
  using ((select private.can_manage_fund(fund_id)));

-- ---------------------------------------------------------------------------
-- Leitura para o público e para integrantes (sem doadores)
-- ---------------------------------------------------------------------------
create function public.fund_overview()
returns table (
  id uuid,
  name text,
  description text,
  goal_cents bigint,
  visibility public.fund_visibility,
  is_active boolean,
  pix_key text,
  pix_holder text,
  pix_instructions text,
  raised_cents bigint,
  spent_cents bigint,
  balance_cents bigint
)
language sql stable security definer
set search_path = ''
as $$
  with caller as (select (select private.is_active_member()) as is_member),
  totals as (
    select
      l.fund_id,
      coalesce(sum(l.amount_cents * case when l.reverses_id is null then 1 else -1 end)
               filter (where l.kind = 'income'), 0) as raised,
      coalesce(sum(l.amount_cents * case when l.reverses_id is null then 1 else -1 end)
               filter (where l.kind = 'expense'), 0) as spent
    from public.ledger_entries l
    group by l.fund_id
  )
  select
    f.id, f.name, f.description, f.goal_cents, f.visibility, f.is_active,
    case when f.is_active then f.pix_key end,
    case when f.is_active then f.pix_holder end,
    case when f.is_active then f.pix_instructions end,
    coalesce(t.raised, 0)::bigint,
    -- visitante vê só o arrecadado; gasto e saldo são de integrantes
    case when c.is_member then coalesce(t.spent, 0)::bigint end,
    case when c.is_member then (coalesce(t.raised, 0) - coalesce(t.spent, 0))::bigint end
  from public.funds f
  cross join caller c
  left join totals t on t.fund_id = f.id
  where (f.visibility = 'public' and f.is_active)
     or (c.is_member and (f.visibility in ('public', 'members')))
  order by f.is_active desc, f.created_at
$$;

create function public.fund_cashflow(p_fund_id uuid)
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
  from public.ledger_entries l
  join public.funds f on f.id = l.fund_id
  where l.fund_id = p_fund_id
    and (select private.is_active_member())
  group by 1
  order by 1 desc
  limit 60
$$;

create function public.fund_expenses(p_fund_id uuid, p_limit integer default 50, p_offset integer default 0)
returns table (
  id uuid,
  occurred_on date,
  category text,
  description text,
  amount_cents bigint,
  is_reversal boolean,
  total bigint
)
language sql stable security definer
set search_path = ''
as $$
  select l.id, l.occurred_on, l.category, l.description, l.amount_cents, l.reverses_id is not null,
         count(*) over ()
  from public.ledger_entries l
  where l.fund_id = p_fund_id
    and l.kind = 'expense'
    and (select private.is_active_member())
  order by l.occurred_on desc, l.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(0, coalesce(p_offset, 0))
$$;

-- ---------------------------------------------------------------------------
-- Escrita: lançar, estornar e designar responsáveis
-- ---------------------------------------------------------------------------
create function public.finance_add_entry(
  p_fund_id uuid,
  p_kind public.ledger_kind,
  p_amount_cents bigint,
  p_occurred_on date,
  p_category text,
  p_description text
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_manage_fund(p_fund_id) then
    raise exception 'Sem permissão para lançar nesta caixinha' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.funds where id = p_fund_id and is_active) then
    raise exception 'Caixinha encerrada' using errcode = 'check_violation';
  end if;
  if p_occurred_on > private.brt_today() then
    raise exception 'A data do lançamento não pode ser futura' using errcode = 'check_violation';
  end if;

  insert into public.ledger_entries (fund_id, kind, amount_cents, occurred_on, category, description, created_by)
  values (p_fund_id, p_kind, p_amount_cents, p_occurred_on, nullif(btrim(p_category), ''), btrim(p_description),
          (select auth.uid()))
  returning id into v_id;

  perform private.log_audit('finance.entry_added', 'ledger_entries', v_id::text,
    jsonb_build_object('fund_id', p_fund_id, 'kind', p_kind, 'amount_cents', p_amount_cents));
  return v_id;
end;
$$;

create function public.finance_reverse_entry(p_entry_id uuid, p_reason text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_orig public.ledger_entries;
  v_id uuid;
begin
  select * into v_orig from public.ledger_entries where id = p_entry_id;
  if not found then
    raise exception 'Lançamento não encontrado' using errcode = 'no_data_found';
  end if;
  if not private.can_manage_fund(v_orig.fund_id) then
    raise exception 'Sem permissão para lançar nesta caixinha' using errcode = 'insufficient_privilege';
  end if;
  if nullif(btrim(p_reason), '') is null or char_length(btrim(p_reason)) > 160 then
    raise exception 'Informe o motivo do estorno (até 160 caracteres)' using errcode = 'check_violation';
  end if;

  insert into public.ledger_entries (fund_id, kind, amount_cents, occurred_on, category, description, reverses_id, created_by)
  values (v_orig.fund_id, v_orig.kind, v_orig.amount_cents, private.brt_today(), v_orig.category,
          'Estorno: ' || btrim(p_reason), v_orig.id, (select auth.uid()))
  returning id into v_id;

  perform private.log_audit('finance.entry_reversed', 'ledger_entries', v_id::text,
    jsonb_build_object('fund_id', v_orig.fund_id, 'reverses_id', v_orig.id, 'amount_cents', v_orig.amount_cents));
  return v_id;
end;
$$;

create function public.finance_set_fund_manager(p_fund_id uuid, p_member_id uuid, p_active boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.has_permission('finance.write') then
    raise exception 'Sem permissão para designar responsáveis' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.funds where id = p_fund_id) then
    raise exception 'Caixinha não encontrada' using errcode = 'no_data_found';
  end if;

  if p_active then
    if not exists (select 1 from public.members where id = p_member_id and status = 'active') then
      raise exception 'Só integrantes ativos podem ser responsáveis' using errcode = 'check_violation';
    end if;
    insert into public.fund_managers (fund_id, member_id, added_by)
    values (p_fund_id, p_member_id, (select auth.uid()))
    on conflict do nothing;
  else
    delete from public.fund_managers where fund_id = p_fund_id and member_id = p_member_id;
  end if;

  perform private.log_audit(
    case when p_active then 'finance.manager_added' else 'finance.manager_removed' end,
    'fund_managers', p_fund_id::text, jsonb_build_object('member_id', p_member_id));
end;
$$;

create function public.finance_list_fund_managers(p_fund_id uuid)
returns table (member_id uuid, display_name text, added_at timestamptz)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.has_permission('finance.write') then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  return query
  select fm.member_id, p.display_name, fm.added_at
  from public.fund_managers fm
  join public.profiles p on p.member_id = fm.member_id
  where fm.fund_id = p_fund_id
  order by fm.added_at;
end;
$$;

-- Funções expostas: sem acesso por padrão; só o que está abaixo.
revoke execute on function
  public.fund_overview(), public.fund_cashflow(uuid), public.fund_expenses(uuid, integer, integer),
  public.finance_add_entry(uuid, public.ledger_kind, bigint, date, text, text),
  public.finance_reverse_entry(uuid, text),
  public.finance_set_fund_manager(uuid, uuid, boolean),
  public.finance_list_fund_managers(uuid)
  from public, anon, authenticated;

grant execute on function public.fund_overview() to anon, authenticated, service_role;
grant execute on function
  public.fund_cashflow(uuid), public.fund_expenses(uuid, integer, integer),
  public.finance_add_entry(uuid, public.ledger_kind, bigint, date, text, text),
  public.finance_reverse_entry(uuid, text),
  public.finance_set_fund_manager(uuid, uuid, boolean),
  public.finance_list_fund_managers(uuid)
  to authenticated, service_role;

-- Vagas para novos moradores: divulgação pública e formulário de interesse.
--
-- Quem vê o quê
--   * qualquer visitante: vagas abertas (título, descrição, valor, data) e o formulário;
--   * quem tem `vacancies.manage` (administrador e superadmin; atribuível a moderador
--     na tela de permissões): todas as vagas e os interesses recebidos.
--
-- Dados de candidatos (pessoas de fora, sem conta)
--   * entram só pela função `vacancy_express_interest` (sem INSERT direto), com aceite da
--     política, limite de envios por hora e resposta idêntica para e-mail repetido;
--   * ficam por no máximo 90 dias: a função apaga os mais antigos a cada novo interesse e
--     a tela de gestão os apaga ao ser aberta (`vacancy_purge_old_interests`);
--   * a gestão pode apagar qualquer interesse na hora.
--   * a auditoria guarda só identificadores, nunca nome, e-mail ou telefone.

insert into public.permissions (key, description) values
  ('vacancies.manage', 'Gerenciar vagas para novos moradores e os interesses recebidos');
insert into public.role_permissions (role, permission) values ('administrador', 'vacancies.manage');

create type public.vacancy_status as enum ('open', 'closed');
create type public.vacancy_interest_status as enum ('new', 'contacted', 'closed');

create table public.vacancies (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  monthly_cents bigint check (monthly_cents > 0 and monthly_cents <= 100000000),
  available_from date,
  status public.vacancy_status not null default 'open',
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vacancies_status_idx on public.vacancies (status, created_at desc);
alter table public.vacancies enable row level security;
create trigger vacancies_touch before update on public.vacancies
  for each row execute function private.touch_updated_at();

create table public.vacancy_interests (
  id uuid primary key default gen_random_uuid(),
  vacancy_id uuid not null references public.vacancies (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 3 and 120),
  email text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (char_length(phone) <= 30),
  course text check (char_length(course) <= 100),
  message text check (char_length(message) <= 1000),
  policy_version text not null check (char_length(policy_version) <= 20),
  status public.vacancy_interest_status not null default 'new',
  created_at timestamptz not null default now()
);
-- Um interesse por e-mail e vaga.
create unique index vacancy_interests_email_idx on public.vacancy_interests (vacancy_id, lower(email));
create index vacancy_interests_created_idx on public.vacancy_interests (created_at);
alter table public.vacancy_interests enable row level security;

create function private.can_manage_vacancies() returns boolean
language sql stable security definer
set search_path = ''
as $$ select private.has_permission('vacancies.manage') $$;
revoke execute on function private.can_manage_vacancies() from public, anon;
grant execute on function private.can_manage_vacancies() to authenticated, service_role;

-- Leitura: vagas abertas são públicas; o resto, só a gestão. Interesses, só a gestão.
grant select on public.vacancies to anon, authenticated;
grant select on public.vacancy_interests to authenticated;

create policy vacancies_select_open on public.vacancies
  for select to anon, authenticated
  using (status = 'open');
create policy vacancies_select_manage on public.vacancies
  for select to authenticated
  using ((select private.can_manage_vacancies()));
-- Mesmo antes da limpeza física, a gestão já não enxerga interesse com mais de 90 dias.
create policy vacancy_interests_select on public.vacancy_interests
  for select to authenticated
  using ((select private.can_manage_vacancies()) and created_at > now() - interval '90 days');

-- ---------------------------------------------------------------------------
-- Gestão das vagas
-- ---------------------------------------------------------------------------
create function public.vacancy_save(
  p_id uuid, p_title text, p_description text, p_monthly_cents bigint, p_available_from date
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.can_manage_vacancies() then
    raise exception 'Sem permissão para gerenciar vagas' using errcode = 'insufficient_privilege';
  end if;
  if p_id is null then
    insert into public.vacancies (title, description, monthly_cents, available_from, created_by)
    values (btrim(p_title), btrim(p_description), p_monthly_cents, p_available_from, (select auth.uid()))
    returning id into v_id;
    perform private.log_audit('vacancy.created', 'vacancies', v_id::text);
  else
    update public.vacancies
       set title = btrim(p_title), description = btrim(p_description),
           monthly_cents = p_monthly_cents, available_from = p_available_from
     where id = p_id
     returning id into v_id;
    if not found then
      raise exception 'Vaga não encontrada' using errcode = 'no_data_found';
    end if;
    perform private.log_audit('vacancy.updated', 'vacancies', v_id::text);
  end if;
  return v_id;
end;
$$;

create function public.vacancy_set_status(p_id uuid, p_status public.vacancy_status) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.can_manage_vacancies() then
    raise exception 'Sem permissão para gerenciar vagas' using errcode = 'insufficient_privilege';
  end if;
  update public.vacancies set status = p_status where id = p_id;
  if not found then
    raise exception 'Vaga não encontrada' using errcode = 'no_data_found';
  end if;
  perform private.log_audit('vacancy.' || p_status::text, 'vacancies', p_id::text);
end;
$$;

-- Apagar a vaga apaga os interesses dela.
create function public.vacancy_delete(p_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.can_manage_vacancies() then
    raise exception 'Sem permissão para gerenciar vagas' using errcode = 'insufficient_privilege';
  end if;
  delete from public.vacancies where id = p_id;
  if not found then
    raise exception 'Vaga não encontrada' using errcode = 'no_data_found';
  end if;
  perform private.log_audit('vacancy.deleted', 'vacancies', p_id::text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Interesse de candidatos (público)
-- ---------------------------------------------------------------------------
create function public.vacancy_express_interest(
  p_vacancy_id uuid, p_name text, p_email text, p_phone text, p_course text,
  p_message text, p_policy_version text
) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_recent integer;
begin
  if not exists (select 1 from public.privacy_policy_versions where version = p_policy_version) then
    raise exception 'Versão da política de privacidade inválida' using errcode = 'check_violation';
  end if;

  -- Retenção: nada de candidato passa de 90 dias.
  delete from public.vacancy_interests where created_at < now() - interval '90 days';

  if not exists (select 1 from public.vacancies where id = p_vacancy_id and status = 'open') then
    return 'closed';
  end if;

  select count(*) into v_recent from public.vacancy_interests where created_at > now() - interval '1 hour';
  if v_recent >= 30 then
    return 'throttled';
  end if;

  begin
    insert into public.vacancy_interests (vacancy_id, name, email, phone, course, message, policy_version)
    values (p_vacancy_id, btrim(p_name), lower(btrim(p_email)), nullif(btrim(p_phone), ''),
            nullif(btrim(p_course), ''), nullif(btrim(p_message), ''), p_policy_version);
  exception when unique_violation then
    -- Mesma resposta de um envio novo: não revela quem já demonstrou interesse.
    return 'ok';
  end;
  return 'ok';
end;
$$;

create function public.vacancy_set_interest_status(p_id uuid, p_status public.vacancy_interest_status)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.can_manage_vacancies() then
    raise exception 'Sem permissão para gerenciar vagas' using errcode = 'insufficient_privilege';
  end if;
  update public.vacancy_interests set status = p_status where id = p_id;
  if not found then
    raise exception 'Interesse não encontrado' using errcode = 'no_data_found';
  end if;
  perform private.log_audit('vacancy.interest_' || p_status::text, 'vacancy_interests', p_id::text);
end;
$$;

create function public.vacancy_delete_interest(p_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.can_manage_vacancies() then
    raise exception 'Sem permissão para gerenciar vagas' using errcode = 'insufficient_privilege';
  end if;
  delete from public.vacancy_interests where id = p_id;
  if not found then
    raise exception 'Interesse não encontrado' using errcode = 'no_data_found';
  end if;
  perform private.log_audit('vacancy.interest_deleted', 'vacancy_interests', p_id::text);
end;
$$;

-- Apaga interesses com mais de 90 dias; chamada ao abrir a tela de gestão.
create function public.vacancy_purge_old_interests() returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.can_manage_vacancies() then
    raise exception 'Sem permissão para gerenciar vagas' using errcode = 'insufficient_privilege';
  end if;
  delete from public.vacancy_interests where created_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function
  public.vacancy_save(uuid, text, text, bigint, date),
  public.vacancy_set_status(uuid, public.vacancy_status),
  public.vacancy_delete(uuid),
  public.vacancy_express_interest(uuid, text, text, text, text, text, text),
  public.vacancy_set_interest_status(uuid, public.vacancy_interest_status),
  public.vacancy_delete_interest(uuid),
  public.vacancy_purge_old_interests()
  from public, anon, authenticated;

grant execute on function
  public.vacancy_save(uuid, text, text, bigint, date),
  public.vacancy_set_status(uuid, public.vacancy_status),
  public.vacancy_delete(uuid),
  public.vacancy_set_interest_status(uuid, public.vacancy_interest_status),
  public.vacancy_delete_interest(uuid),
  public.vacancy_purge_old_interests()
  to authenticated, service_role;

-- O formulário público não tem login.
grant execute on function public.vacancy_express_interest(uuid, text, text, text, text, text, text)
  to anon, authenticated, service_role;

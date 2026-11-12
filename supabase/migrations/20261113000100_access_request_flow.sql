-- Etapa 3, módulo 1: solicitação de acesso.
--
-- O visitante deixa de inserir direto na tabela e passa a usar uma função,
-- que valida a versão da política, registra o consentimento, limita o volume
-- de envios e não revela se já existe solicitação para o mesmo e-mail.

insert into public.privacy_policy_versions (version, summary)
values ('2026-11', 'Primeira versão da política de privacidade do portal.')
on conflict (version) do nothing;

-- Limite global de envios por hora: o banco não conhece o IP de quem envia
-- (quem fala com o Supabase é o servidor do portal), então a contenção de
-- spam aqui é por volume total. O formulário ainda tem um campo-isca.
create function public.submit_membership_request(
  p_full_name text,
  p_email text,
  p_relationship text,
  p_justification text,
  p_policy_version text,
  p_nickname text default null,
  p_phone text default null,
  p_extra_info text default null
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

  select count(*) into v_recent
  from public.membership_requests
  where created_at > now() - interval '1 hour';
  if v_recent >= 20 then
    return 'throttled';
  end if;

  begin
    insert into public.membership_requests
      (full_name, nickname, email, phone, relationship, justification, extra_info, policy_version)
    values
      (btrim(p_full_name), nullif(btrim(p_nickname), ''), lower(btrim(p_email)),
       nullif(btrim(p_phone), ''), btrim(p_relationship), btrim(p_justification),
       nullif(btrim(p_extra_info), ''), p_policy_version);
  exception when unique_violation then
    -- Já existe solicitação em andamento para este e-mail. A resposta é a
    -- mesma de um envio novo, para não revelar quem já pediu acesso.
    return 'ok';
  end;

  -- O consentimento é gravado pelo trigger já existente em membership_requests.
  return 'ok';
end;
$$;

revoke execute on function public.submit_membership_request(text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_membership_request(text, text, text, text, text, text, text, text)
  to anon, authenticated, service_role;

-- O caminho direto pela tabela é fechado: toda solicitação passa pela função.
revoke insert on public.membership_requests from anon, authenticated;
drop policy membership_requests_insert on public.membership_requests;

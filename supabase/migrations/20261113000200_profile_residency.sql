-- Etapa 3, módulo 2: perfis.
--
-- Período de residência: as datas ficam em `members`, que o integrante não
-- pode gravar diretamente (lá também estão papel, categoria e status).
-- Esta função altera SOMENTE as duas datas do próprio integrante.
create function public.set_my_residency(p_joined_on date, p_left_on date) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.is_active_member() then
    raise exception 'Apenas integrantes ativos' using errcode = 'insufficient_privilege';
  end if;
  if p_joined_on is not null and (p_joined_on < date '1950-01-01' or p_joined_on > current_date) then
    raise exception 'Data de entrada inválida' using errcode = 'check_violation';
  end if;
  if p_left_on is not null and p_left_on > current_date then
    raise exception 'Data de saída inválida' using errcode = 'check_violation';
  end if;

  update public.members
     set joined_republic_on = p_joined_on,
         left_republic_on = p_left_on
   where id = v_uid;
end;
$$;

revoke execute on function public.set_my_residency(date, date) from public, anon, authenticated;
grant execute on function public.set_my_residency(date, date) to authenticated, service_role;

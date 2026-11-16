-- Flyer (imagem de divulgação) opcional em cada evento.
--
-- O arquivo fica em bucket privado, sem política de storage: só o servidor lê e
-- grava. Quem vê o flyer é decidido pela RLS de `events`, na rota
-- /api/eventos/<id>/flyer: se a pessoa pode ler o evento (público, só
-- integrantes ou rascunho de quem gerencia), pode ver a imagem; senão, 404.
-- O caminho do arquivo só muda pela função abaixo, nunca por UPDATE direto,
-- para que ninguém aponte o evento para um arquivo que não é dele.

alter table public.events
  add column flyer_path text
    check (flyer_path is null or char_length(flyer_path) <= 120);

-- Visitante precisa saber se há flyer nos eventos públicos que já lê.
grant select (flyer_path) on public.events to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('event-media', 'event-media', false, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- Troca ou remove o flyer. Devolve o caminho anterior para o servidor apagar o
-- arquivo velho. O caminho tem de ser "<id do evento>/<uuid>.webp".
create function public.set_event_flyer(p_event_id uuid, p_path text) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if not private.has_permission('events.manage') then
    raise exception 'Sem permissão para gerenciar eventos' using errcode = 'insufficient_privilege';
  end if;
  if p_path is not null
     and p_path !~ ('^' || p_event_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$') then
    raise exception 'Caminho de flyer inválido' using errcode = 'check_violation';
  end if;

  select flyer_path into v_old from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Evento não encontrado' using errcode = 'no_data_found';
  end if;

  update public.events set flyer_path = p_path where id = p_event_id;
  return v_old;
end;
$$;
revoke execute on function public.set_event_flyer(uuid, text) from public, anon, authenticated;
grant execute on function public.set_event_flyer(uuid, text) to authenticated, service_role;

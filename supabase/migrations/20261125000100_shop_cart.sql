-- Loja com carrinho e PIX.
--
-- Um pedido passa a ter vários itens (`shop_orders` + `shop_order_items`). Os pedidos
-- antigos (um item cada) são copiados e a tabela `product_orders` some. O preço de cada
-- item é "congelado" no pedido. O pagamento continua manual: a pessoa paga o PIX (QR
-- gerado pelo portal com a chave da loja) e quem gerencia a loja confere e marca como pago.

-- ---------------------------------------------------------------------------
-- Pedidos e itens
-- ---------------------------------------------------------------------------
create table public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members (id) on delete set null,
  status public.order_status not null default 'requested',
  total_cents bigint not null check (total_cents >= 0 and total_cents <= 1000000000),
  note text check (char_length(note) <= 300),
  payment_instructions text check (char_length(payment_instructions) <= 500),
  manager_note text check (char_length(manager_note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shop_orders_member_idx on public.shop_orders (member_id, created_at desc);
create index shop_orders_status_idx on public.shop_orders (status, created_at desc);
alter table public.shop_orders enable row level security;
create trigger shop_orders_touch before update on public.shop_orders
  for each row execute function private.touch_updated_at();

create table public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 20),
  size text check (char_length(size) <= 12)
);
create index shop_order_items_order_idx on public.shop_order_items (order_id);
alter table public.shop_order_items enable row level security;

-- Copia os pedidos já existentes (mesmo id, um item cada).
insert into public.shop_orders (id, member_id, status, total_cents, note, payment_instructions, manager_note, created_at, updated_at)
select id, member_id, status, unit_price_cents * quantity, note, left(payment_instructions, 500), manager_note, created_at, updated_at
from public.product_orders;
insert into public.shop_order_items (order_id, product_id, product_name, unit_price_cents, quantity, size)
select id, product_id, product_name, unit_price_cents, quantity, size from public.product_orders;

drop function public.shop_request_order(uuid, integer, text, text);
drop function public.shop_list_orders(public.order_status);
drop table public.product_orders;

grant select on public.shop_orders, public.shop_order_items to authenticated;
create policy shop_orders_select on public.shop_orders
  for select to authenticated
  using (member_id = (select auth.uid()) or (select private.can_manage_shop()));
create policy shop_order_items_select on public.shop_order_items
  for select to authenticated
  using (exists (select 1 from public.shop_orders o where o.id = order_id));

-- ---------------------------------------------------------------------------
-- Chave PIX da loja (uma só; troca-se quando houver a Associação)
-- ---------------------------------------------------------------------------
create table public.shop_settings (
  singleton boolean primary key default true check (singleton),
  pix_key text check (char_length(pix_key) between 1 and 77),
  pix_receiver text check (char_length(pix_receiver) between 1 and 25),
  pix_city text check (char_length(pix_city) between 1 and 15),
  updated_by uuid references public.members (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.shop_settings enable row level security;
grant select on public.shop_settings to authenticated;
create policy shop_settings_select on public.shop_settings
  for select to authenticated
  using ((select private.is_active_member()) or (select private.can_manage_shop()));

create function public.shop_set_pix(p_key text, p_receiver text, p_city text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_key text := nullif(btrim(p_key), '');
  v_receiver text := nullif(btrim(p_receiver), '');
  v_city text := nullif(btrim(p_city), '');
begin
  if not private.has_permission('store.manage') then
    raise exception 'Sem permissão para alterar o PIX da loja' using errcode = 'insufficient_privilege';
  end if;
  if v_key is not null and (v_receiver is null or v_city is null) then
    raise exception 'Informe o nome do recebedor e a cidade' using errcode = 'check_violation';
  end if;
  insert into public.shop_settings (singleton, pix_key, pix_receiver, pix_city, updated_by, updated_at)
  values (true, v_key, v_receiver, v_city, (select auth.uid()), now())
  on conflict (singleton) do update
    set pix_key = excluded.pix_key, pix_receiver = excluded.pix_receiver, pix_city = excluded.pix_city,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  -- A chave não vai para a auditoria: só o fato de que mudou.
  perform private.log_audit('shop.pix_updated', 'shop_settings', 'singleton',
    jsonb_build_object('enabled', v_key is not null));
end;
$$;

-- ---------------------------------------------------------------------------
-- Finalizar o carrinho
-- ---------------------------------------------------------------------------
create function public.shop_checkout(p_items jsonb, p_note text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product public.products;
  v_qty integer;
  v_size text;
  v_total bigint := 0;
  v_order uuid;
  v_instructions text;
  v_count integer;
begin
  if not private.is_active_member() then
    raise exception 'Só integrantes ativos fazem pedidos' using errcode = 'insufficient_privilege';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Carrinho inválido' using errcode = 'check_violation';
  end if;
  v_count := jsonb_array_length(p_items);
  if v_count < 1 or v_count > 20 then
    raise exception 'O carrinho deve ter de 1 a 20 itens' using errcode = 'check_violation';
  end if;
  if (select count(*) from public.shop_orders
      where member_id = (select auth.uid()) and status = 'requested') >= 10 then
    raise exception 'Você já tem 10 pedidos aguardando confirmação' using errcode = 'check_violation';
  end if;

  insert into public.shop_orders (member_id, total_cents, note)
  values ((select auth.uid()), 0, nullif(btrim(p_note), ''))
  returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
     where id = (v_item ->> 'product_id')::uuid and is_published;
    if not found then
      raise exception 'Produto não encontrado' using errcode = 'no_data_found';
    end if;
    if not v_product.is_available then
      raise exception 'Produto esgotado: %', v_product.name using errcode = 'check_violation';
    end if;
    v_qty := (v_item ->> 'quantity')::integer;
    if v_qty is null or v_qty < 1 or v_qty > 20 then
      raise exception 'Quantidade deve ficar entre 1 e 20' using errcode = 'check_violation';
    end if;
    v_size := nullif(btrim(v_item ->> 'size'), '');
    if cardinality(v_product.sizes) > 0 then
      if v_size is null or not (v_size = any (v_product.sizes)) then
        raise exception 'Escolha um tamanho válido para %', v_product.name using errcode = 'check_violation';
      end if;
    else
      v_size := null;
    end if;
    insert into public.shop_order_items (order_id, product_id, product_name, unit_price_cents, quantity, size)
    values (v_order, v_product.id, v_product.name, v_product.price_cents, v_qty, v_size);
    v_total := v_total + v_product.price_cents * v_qty;
  end loop;

  if v_total > 1000000000 then
    raise exception 'Total do pedido acima do limite' using errcode = 'check_violation';
  end if;
  select left(string_agg(distinct p.payment_instructions, E'\n'), 500) into v_instructions
    from public.shop_order_items i join public.products p on p.id = i.product_id
   where i.order_id = v_order and p.payment_instructions is not null;
  update public.shop_orders set total_cents = v_total, payment_instructions = v_instructions where id = v_order;

  perform private.log_audit('shop.order_requested', 'shop_orders', v_order::text,
    jsonb_build_object('items', v_count, 'total_cents', v_total));
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelar, mudar status e listar (substituem as versões de item único)
-- ---------------------------------------------------------------------------
create or replace function public.shop_cancel_order(p_order_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.shop_orders
     set status = 'cancelled'
   where id = p_order_id and member_id = (select auth.uid()) and status = 'requested';
  if not found then
    raise exception 'Só dá para cancelar pedidos ainda não confirmados' using errcode = 'check_violation';
  end if;
  perform private.log_audit('shop.order_cancelled_by_member', 'shop_orders', p_order_id::text, '{}'::jsonb);
end;
$$;

create or replace function public.shop_set_order_status(p_order_id uuid, p_status public.order_status, p_note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order public.shop_orders;
begin
  if not private.can_manage_shop() then
    raise exception 'Sem permissão para gerenciar pedidos' using errcode = 'insufficient_privilege';
  end if;
  select * into v_order from public.shop_orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'no_data_found';
  end if;
  if not (
    (v_order.status = 'requested' and p_status in ('confirmed', 'paid', 'cancelled'))
    or (v_order.status = 'confirmed' and p_status in ('paid', 'cancelled'))
    or (v_order.status = 'paid' and p_status in ('delivered', 'cancelled'))
  ) then
    raise exception 'Mudança de status não permitida' using errcode = 'check_violation';
  end if;
  update public.shop_orders
     set status = p_status, manager_note = nullif(btrim(p_note), '')
   where id = p_order_id;
  perform private.log_audit('shop.order_status', 'shop_orders', p_order_id::text,
    jsonb_build_object('from', v_order.status, 'to', p_status));
end;
$$;

create function public.shop_list_orders(p_status public.order_status default null)
returns table (
  id uuid, member_id uuid, member_name text, status public.order_status, total_cents bigint,
  note text, manager_note text, created_at timestamptz, items jsonb
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.can_manage_shop() then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  return query
  select o.id, o.member_id, coalesce(p.display_name, 'Conta excluída'), o.status, o.total_cents,
         o.note, o.manager_note, o.created_at,
         (select coalesce(jsonb_agg(jsonb_build_object(
                    'product_name', i.product_name, 'unit_price_cents', i.unit_price_cents,
                    'quantity', i.quantity, 'size', i.size) order by i.product_name), '[]'::jsonb)
            from public.shop_order_items i where i.order_id = o.id)
  from public.shop_orders o
  left join public.profiles p on p.member_id = o.member_id
  where p_status is null or o.status = p_status
  order by o.created_at desc
  limit 300;
end;
$$;

revoke execute on function
  public.shop_set_pix(text, text, text), public.shop_checkout(jsonb, text), public.shop_list_orders(public.order_status)
  from public, anon, authenticated;
grant execute on function
  public.shop_set_pix(text, text, text), public.shop_checkout(jsonb, text), public.shop_list_orders(public.order_status)
  to authenticated, service_role;

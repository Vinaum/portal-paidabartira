-- Loja: catálogo com pedidos de compra, sem pagamento no site.
--
--   * cada produto escolhe quem o vê: público (festas, itens abertos à Unicamp)
--     ou só integrantes (itens para quem mora ou já morou);
--   * só integrantes ativos fazem pedido; o pagamento (PIX) é combinado fora
--     do site e o pedido acompanha o status (solicitado, confirmado, pago,
--     entregue, cancelado);
--   * gerenciam produtos e pedidos: quem tem `store.manage` (administrador,
--     superadmin) e os responsáveis da loja designados por eles;
--   * o pedido guarda cópia do nome e do preço na hora da compra, então mudar
--     o produto depois não altera pedidos antigos.

create type public.product_visibility as enum ('public', 'members');
create type public.order_status as enum ('requested', 'confirmed', 'paid', 'delivered', 'cancelled');

create table public.shop_managers (
  member_id uuid primary key references public.members (id) on delete cascade,
  added_by uuid references public.members (id) on delete set null,
  added_at timestamptz not null default now()
);
alter table public.shop_managers enable row level security;

create function private.can_manage_shop() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.has_permission('store.manage')
    or exists (
      select 1
      from public.shop_managers sm
      join public.members m on m.id = sm.member_id
      where sm.member_id = (select auth.uid()) and m.status = 'active'
    )
$$;
revoke execute on function private.can_manage_shop() from public, anon;
grant execute on function private.can_manage_shop() to authenticated, service_role;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 80),
  description text check (char_length(description) <= 1500),
  price_cents bigint not null check (price_cents >= 0 and price_cents <= 100000000),
  visibility public.product_visibility not null default 'members',
  sizes text[] not null default '{}'
    check (cardinality(sizes) <= 12 and array_position(sizes, null) is null),
  payment_instructions text check (char_length(payment_instructions) <= 500),
  photo_path text check (char_length(photo_path) <= 200),
  is_published boolean not null default false,
  is_available boolean not null default true,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;
create trigger products_touch before update on public.products
  for each row execute function private.touch_updated_at();

create function private.audit_product() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (
    (select auth.uid()), lower(tg_op), 'products', new.id::text,
    jsonb_build_object('name', new.name, 'price_cents', new.price_cents, 'visibility', new.visibility,
                       'is_published', new.is_published, 'is_available', new.is_available)
  );
  return new;
end;
$$;
create trigger products_audit after insert or update on public.products
  for each row execute function private.audit_product();

create table public.product_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  member_id uuid references public.members (id) on delete set null,
  product_name text not null,
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 20),
  size text check (char_length(size) <= 12),
  note text check (char_length(note) <= 300),
  payment_instructions text,
  status public.order_status not null default 'requested',
  manager_note text check (char_length(manager_note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_orders_member_idx on public.product_orders (member_id, created_at desc);
create index product_orders_status_idx on public.product_orders (status, created_at desc);
alter table public.product_orders enable row level security;
create trigger product_orders_touch before update on public.product_orders
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Acesso direto
-- ---------------------------------------------------------------------------
grant select on public.products to anon, authenticated;
grant insert (name, description, price_cents, visibility, sizes, payment_instructions, photo_path,
              is_published, is_available, created_by) on public.products to authenticated;
grant update (name, description, price_cents, visibility, sizes, payment_instructions, photo_path,
              is_published, is_available) on public.products to authenticated;

create policy products_select_anon on public.products
  for select to anon
  using (is_published and visibility = 'public');
create policy products_select_auth on public.products
  for select to authenticated
  using (
    (select private.can_manage_shop())
    or (is_published and (visibility = 'public' or (select private.is_active_member())))
  );
create policy products_insert on public.products
  for insert to authenticated
  with check ((select private.can_manage_shop()) and created_by = (select auth.uid()));
create policy products_update on public.products
  for update to authenticated
  using ((select private.can_manage_shop()))
  with check ((select private.can_manage_shop()));

grant select on public.product_orders to authenticated;
create policy orders_select on public.product_orders
  for select to authenticated
  using (member_id = (select auth.uid()) or (select private.can_manage_shop()));

grant select on public.shop_managers to authenticated;
create policy shop_managers_select on public.shop_managers
  for select to authenticated
  using ((select private.has_permission('store.manage')) or member_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
create function public.shop_request_order(p_product_id uuid, p_quantity integer, p_size text, p_note text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_product public.products;
  v_size text := nullif(btrim(p_size), '');
  v_id uuid;
begin
  if not private.is_active_member() then
    raise exception 'Só integrantes ativos fazem pedidos' using errcode = 'insufficient_privilege';
  end if;
  select * into v_product from public.products where id = p_product_id and is_published;
  if not found then
    raise exception 'Produto não encontrado' using errcode = 'no_data_found';
  end if;
  if not v_product.is_available then
    raise exception 'Produto esgotado' using errcode = 'check_violation';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 20 then
    raise exception 'Quantidade deve ficar entre 1 e 20' using errcode = 'check_violation';
  end if;
  if cardinality(v_product.sizes) > 0 then
    if v_size is null or not (v_size = any (v_product.sizes)) then
      raise exception 'Escolha um tamanho válido' using errcode = 'check_violation';
    end if;
  else
    v_size := null;
  end if;
  if (select count(*) from public.product_orders
      where member_id = (select auth.uid()) and status = 'requested') >= 10 then
    raise exception 'Você já tem 10 pedidos aguardando confirmação' using errcode = 'check_violation';
  end if;

  insert into public.product_orders
    (product_id, member_id, product_name, unit_price_cents, quantity, size, note, payment_instructions)
  values
    (v_product.id, (select auth.uid()), v_product.name, v_product.price_cents, p_quantity, v_size,
     nullif(btrim(p_note), ''), v_product.payment_instructions)
  returning id into v_id;

  perform private.log_audit('shop.order_requested', 'product_orders', v_id::text,
    jsonb_build_object('product_id', v_product.id, 'quantity', p_quantity));
  return v_id;
end;
$$;

create function public.shop_cancel_order(p_order_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.product_orders
     set status = 'cancelled'
   where id = p_order_id and member_id = (select auth.uid()) and status = 'requested';
  if not found then
    raise exception 'Só dá para cancelar pedidos ainda não confirmados' using errcode = 'check_violation';
  end if;
  perform private.log_audit('shop.order_cancelled_by_member', 'product_orders', p_order_id::text, '{}'::jsonb);
end;
$$;

create function public.shop_set_order_status(p_order_id uuid, p_status public.order_status, p_note text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_order public.product_orders;
begin
  if not private.can_manage_shop() then
    raise exception 'Sem permissão para gerenciar pedidos' using errcode = 'insufficient_privilege';
  end if;
  select * into v_order from public.product_orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'no_data_found';
  end if;
  if not (
    (v_order.status = 'requested' and p_status in ('confirmed', 'cancelled'))
    or (v_order.status = 'confirmed' and p_status in ('paid', 'cancelled'))
    or (v_order.status = 'paid' and p_status in ('delivered', 'cancelled'))
  ) then
    raise exception 'Mudança de status não permitida' using errcode = 'check_violation';
  end if;
  update public.product_orders
     set status = p_status, manager_note = nullif(btrim(p_note), '')
   where id = p_order_id;
  perform private.log_audit('shop.order_status', 'product_orders', p_order_id::text,
    jsonb_build_object('from', v_order.status, 'to', p_status));
end;
$$;

create function public.shop_list_orders(p_status public.order_status default null)
returns table (
  id uuid, member_id uuid, member_name text, product_name text, unit_price_cents bigint,
  quantity integer, size text, note text, status public.order_status, manager_note text,
  created_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.can_manage_shop() then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  return query
  select o.id, o.member_id, coalesce(p.display_name, 'Conta excluída'), o.product_name, o.unit_price_cents,
         o.quantity, o.size, o.note, o.status, o.manager_note, o.created_at
  from public.product_orders o
  left join public.profiles p on p.member_id = o.member_id
  where p_status is null or o.status = p_status
  order by o.created_at desc
  limit 300;
end;
$$;

create function public.shop_set_manager(p_member_id uuid, p_active boolean) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.has_permission('store.manage') then
    raise exception 'Sem permissão para designar responsáveis' using errcode = 'insufficient_privilege';
  end if;
  if p_active then
    if not exists (select 1 from public.members where id = p_member_id and status = 'active') then
      raise exception 'Só integrantes ativos podem ser responsáveis' using errcode = 'check_violation';
    end if;
    insert into public.shop_managers (member_id, added_by) values (p_member_id, (select auth.uid()))
    on conflict do nothing;
  else
    delete from public.shop_managers where member_id = p_member_id;
  end if;
  perform private.log_audit(case when p_active then 'shop.manager_added' else 'shop.manager_removed' end,
    'shop_managers', p_member_id::text, '{}'::jsonb);
end;
$$;

create function public.shop_list_managers()
returns table (member_id uuid, display_name text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.has_permission('store.manage') then
    raise exception 'Sem permissão' using errcode = 'insufficient_privilege';
  end if;
  return query
  select sm.member_id, p.display_name
  from public.shop_managers sm join public.profiles p on p.member_id = sm.member_id
  order by sm.added_at;
end;
$$;

revoke execute on function
  public.shop_request_order(uuid, integer, text, text), public.shop_cancel_order(uuid),
  public.shop_set_order_status(uuid, public.order_status, text), public.shop_list_orders(public.order_status),
  public.shop_set_manager(uuid, boolean), public.shop_list_managers()
  from public, anon, authenticated;
grant execute on function
  public.shop_request_order(uuid, integer, text, text), public.shop_cancel_order(uuid),
  public.shop_set_order_status(uuid, public.order_status, text), public.shop_list_orders(public.order_status),
  public.shop_set_manager(uuid, boolean), public.shop_list_managers()
  to authenticated, service_role;

-- Fotos de produto: bucket privado; só o servidor grava (chave secreta) e
-- entrega URLs assinadas dos produtos que a RLS já deixou a pessoa ver.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('shop-media', 'shop-media', false, 5242880, array['image/webp'])
on conflict (id) do nothing;

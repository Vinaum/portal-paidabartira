-- Loja: visibilidade por produto, carrinho (pedido com itens), PIX da loja, gestão e status.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;
select plan(41);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'resp@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'membro@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'mod@example.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'suspenso@example.test');
select private.create_member('00000000-0000-0000-0000-0000000000a1', 'ex_morador', false, 'administrador', 'Admin Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a2', 'atual_morador', false, 'membro', 'Responsável Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a3', 'agregado', false, 'membro', 'Membro Comum', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a4', 'atual_morador', false, 'moderador', 'Moderador Um', null, null);
select private.create_member('00000000-0000-0000-0000-0000000000a5', 'agregado', false, 'membro', 'Suspenso Um', null, null);
update public.members set status = 'suspended' where id = '00000000-0000-0000-0000-0000000000a5';

insert into public.products (id, name, price_cents, visibility, sizes, is_published, is_available, payment_instructions) values
  ('00000000-0000-0000-0000-0000000000b1', 'Ingresso da festa', 3000, 'public', '{}', true, true, 'PIX para a tesouraria'),
  ('00000000-0000-0000-0000-0000000000b2', 'Camiseta EC06', 6000, 'members', '{P,M,G}', true, true, null),
  ('00000000-0000-0000-0000-0000000000b3', 'Rascunho', 1000, 'public', '{}', false, true, null),
  ('00000000-0000-0000-0000-0000000000b4', 'Caneca esgotada', 2500, 'members', '{}', true, false, null);
insert into public.shop_managers (member_id) values ('00000000-0000-0000-0000-0000000000a2');

create function public.t_login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;
grant execute on function public.t_login(uuid) to authenticated;
grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;

-- Visitante
set local role anon;
select is((select count(*) from public.products)::int, 1, 'visitante vê só produto público e publicado');
select throws_ok($$select * from public.shop_orders$$, '42501', null, 'visitante não lê pedidos');
select throws_ok($$select public.shop_checkout('[{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":1}]'::jsonb, null)$$, '42501', null, 'visitante não faz pedido');
select throws_ok($$select * from public.shop_settings$$, '42501', null, 'visitante não lê o PIX da loja');
reset role;

-- Integrante comum
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*) from public.products)::int, 3, 'integrante vê públicos e de integrantes, sem rascunho');
select throws_ok($$insert into public.products (name, price_cents, created_by) values ('Hack', 1, '00000000-0000-0000-0000-0000000000a3')$$, '42501', null, 'integrante não cria produto');
update public.products set price_cents = 1 where id = '00000000-0000-0000-0000-0000000000b1';
select is((select price_cents from public.products where id = '00000000-0000-0000-0000-0000000000b1'), 3000::bigint, 'integrante não altera produto');
select lives_ok($$select public.shop_checkout('[{"product_id":"00000000-0000-0000-0000-0000000000b2","quantity":2,"size":"M"},{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":1,"size":"M"}]'::jsonb, 'Quero azul')$$, 'integrante finaliza carrinho com dois produtos');
select is((select count(*) from public.shop_orders)::int, 1, 'um pedido para o carrinho inteiro');
select is((select count(*) from public.shop_order_items)::int, 2, 'com dois itens');
select is((select total_cents from public.shop_orders), 15000::bigint, 'total soma preço x quantidade (2 x 60,00 + 30,00)');
select is((select size from public.shop_order_items where product_name = 'Ingresso da festa'), null, 'tamanho descartado em produto sem tamanhos');
select is((select payment_instructions from public.shop_orders), 'PIX para a tesouraria', 'pedido guarda cópia das orientações de pagamento');
select throws_ok($$select public.shop_checkout('[{"product_id":"00000000-0000-0000-0000-0000000000b2","quantity":1,"size":"XG"}]'::jsonb, null)$$, '23514', null, 'tamanho inválido');
select throws_ok($$select public.shop_checkout('[{"product_id":"00000000-0000-0000-0000-0000000000b2","quantity":1}]'::jsonb, null)$$, '23514', null, 'tamanho obrigatório');
select throws_ok($$select public.shop_checkout('[{"product_id":"00000000-0000-0000-0000-0000000000b4","quantity":1}]'::jsonb, null)$$, '23514', null, 'produto esgotado');
select throws_ok($$select public.shop_checkout('[{"product_id":"00000000-0000-0000-0000-0000000000b3","quantity":1}]'::jsonb, null)$$, 'P0002', null, 'rascunho não pode ser pedido');
select throws_ok($$select public.shop_checkout('[{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":21}]'::jsonb, null)$$, '23514', null, 'quantidade acima do limite');
select throws_ok($$select public.shop_checkout('[]'::jsonb, null)$$, '23514', null, 'carrinho vazio');
select throws_ok($$select public.shop_checkout('{"a":1}'::jsonb, null)$$, '23514', null, 'carrinho que não é lista');
select is((select count(*) from public.shop_orders)::int, 1, 'pedidos recusados não deixam resto (transação desfeita)');
select throws_ok($$select * from public.shop_list_orders(null)$$, '42501', null, 'integrante não lista pedidos de todos');
select throws_ok($$select public.shop_set_order_status((select id from public.shop_orders limit 1), 'confirmed', null)$$, '42501', null, 'integrante não muda status');
select throws_ok($$select public.shop_set_manager('00000000-0000-0000-0000-0000000000a3', true)$$, '42501', null, 'integrante não se designa responsável');
select throws_ok($$select public.shop_set_pix('chave', 'Casa', 'Campinas')$$, '42501', null, 'integrante não altera o PIX');

-- Preço do produto muda: pedido antigo permanece
reset role;
update public.products set price_cents = 9999 where id = '00000000-0000-0000-0000-0000000000b1';
select is((select unit_price_cents from public.shop_order_items where product_name = 'Ingresso da festa'), 3000::bigint, 'pedido antigo mantém o preço da época');

-- Suspenso
select public.t_login('00000000-0000-0000-0000-0000000000a5');
select throws_ok($$select public.shop_checkout('[{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":1}]'::jsonb, null)$$, '42501', null, 'suspenso não faz pedido');

-- Responsável da loja
select public.t_login('00000000-0000-0000-0000-0000000000a2');
select is((select count(*) from public.shop_list_orders(null))::int, 1, 'responsável lista todos os pedidos');
select is((select jsonb_array_length(items) from public.shop_list_orders(null)), 2, 'com os itens de cada pedido');
select lives_ok($$select public.shop_set_order_status((select id from public.shop_orders), 'paid', 'PIX conferido')$$, 'responsável marca como pago direto do solicitado');
select throws_ok($$select public.shop_set_order_status((select id from public.shop_orders), 'requested', null)$$, '23514', null, 'não volta etapas');
select throws_ok($$select public.shop_set_manager('00000000-0000-0000-0000-0000000000a4', true)$$, '42501', null, 'responsável não designa outros');
select throws_ok($$select public.shop_set_pix('chave', 'Casa', 'Campinas')$$, '42501', null, 'responsável não altera o PIX');

-- Administrador
select public.t_login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$select public.shop_set_manager('00000000-0000-0000-0000-0000000000a4', true)$$, 'administrador designa responsável');
select lives_ok($$select public.shop_set_pix('casa@example.test', 'Republica Paidabartira', 'Campinas')$$, 'administrador define o PIX da loja');
select throws_ok($$select public.shop_set_pix('casa@example.test', null, null)$$, '23514', null, 'PIX exige recebedor e cidade');
select is((select details::text from public.audit_logs where action = 'shop.pix_updated' limit 1), '{"enabled": true}', 'auditoria do PIX não guarda a chave');

-- Integrante lê o PIX; cancelamento só antes da confirmação
select public.t_login('00000000-0000-0000-0000-0000000000a3');
select is((select pix_key from public.shop_settings), 'casa@example.test', 'integrante lê a chave PIX para pagar');
select throws_ok($$select public.shop_cancel_order((select id from public.shop_orders))$$, '23514', null, 'pedido pago não é cancelado pelo integrante');
select lives_ok($$select public.shop_checkout('[{"product_id":"00000000-0000-0000-0000-0000000000b1","quantity":1}]'::jsonb, null)$$, 'novo pedido');
select lives_ok($$select public.shop_cancel_order((select id from public.shop_orders where status = 'requested'))$$, 'integrante cancela pedido ainda solicitado');

select * from finish();
rollback;

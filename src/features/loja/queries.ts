import "server-only";

import { z } from "zod";

import { listMemberOptions } from "@/features/caixinha/queries";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { ORDER_STATUSES, PRODUCT_VISIBILITIES } from "./schemas";

export const SHOP_BUCKET = "shop-media";

const productRow = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  price_cents: z.number(),
  visibility: z.enum(PRODUCT_VISIBILITIES),
  sizes: z.array(z.string()),
  payment_instructions: z.string().nullable(),
  photo_path: z.string().nullable(),
  is_published: z.boolean(),
  is_available: z.boolean(),
});
export type Product = z.infer<typeof productRow> & { photoUrl: string | null };

const COLUMNS =
  "id, name, description, price_cents, visibility, sizes, payment_instructions, photo_path, is_published, is_available";

/** Endereços assinados (1 h) das fotos dos produtos que a RLS já liberou para quem consulta. */
async function withPhotos(rows: z.infer<typeof productRow>[]): Promise<Product[]> {
  const paths = rows.map((row) => row.photo_path).filter((path): path is string => Boolean(path));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await createAdminClient().storage.from(SHOP_BUCKET).createSignedUrls(paths, 3600);
    for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return rows.map((row) => ({ ...row, photoUrl: row.photo_path ? (urls.get(row.photo_path) ?? null) : null }));
}

/** Produtos visíveis a quem consulta (visitante, integrante ou gestor) — a RLS decide. */
export async function listProducts(): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select(COLUMNS).order("created_at", { ascending: false });
  if (error) throw new Error(`Falha ao ler os produtos: ${error.message}`);
  return withPhotos(z.array(productRow).parse(data ?? []));
}

export async function getProduct(id: string): Promise<Product | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao ler o produto: ${error.message}`);
  if (!data) return null;
  return (await withPhotos([productRow.parse(data)]))[0] ?? null;
}

const itemRow = z.object({
  product_name: z.string(),
  unit_price_cents: z.number(),
  quantity: z.number(),
  size: z.string().nullable(),
});
export type OrderItem = z.infer<typeof itemRow>;

const myOrderRow = z.object({
  id: z.uuid(),
  status: z.enum(ORDER_STATUSES),
  total_cents: z.number(),
  note: z.string().nullable(),
  payment_instructions: z.string().nullable(),
  manager_note: z.string().nullable(),
  created_at: z.string(),
  shop_order_items: z.array(itemRow),
});
export type MyOrder = z.infer<typeof myOrderRow>;

const ORDER_COLUMNS =
  "id, status, total_cents, note, payment_instructions, manager_note, created_at, shop_order_items(product_name, unit_price_cents, quantity, size)";

/** Pedidos de uma pessoa (a RLS já limita ao dono ou a quem gerencia a loja). */
export async function listMyOrders(memberId: string): Promise<MyOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(ORDER_COLUMNS)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Falha ao ler os pedidos: ${error.message}`);
  return z.array(myOrderRow).parse(data ?? []);
}

export async function getMyOrder(id: string, memberId: string): Promise<MyOrder | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("shop_orders").select(ORDER_COLUMNS).eq("id", id).eq("member_id", memberId).maybeSingle();
  if (error) throw new Error(`Falha ao ler o pedido: ${error.message}`);
  return data ? myOrderRow.parse(data) : null;
}

const managedOrderRow = z.object({
  id: z.uuid(),
  member_name: z.string(),
  status: z.enum(ORDER_STATUSES),
  total_cents: z.number(),
  note: z.string().nullable(),
  manager_note: z.string().nullable(),
  created_at: z.string(),
  items: z.array(itemRow),
});
export type ManagedOrder = z.infer<typeof managedOrderRow>;

export async function listOrders(status?: string): Promise<ManagedOrder[]> {
  const parsed = z.enum(ORDER_STATUSES).safeParse(status);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shop_list_orders", { p_status: parsed.success ? parsed.data : undefined });
  if (error) throw new Error(`Falha ao ler os pedidos: ${error.message}`);
  return z.array(managedOrderRow).parse(data ?? []);
}

const pixRow = z.object({ pix_key: z.string().nullable(), pix_receiver: z.string().nullable(), pix_city: z.string().nullable() });
export type ShopPix = { key: string; receiver: string; city: string };

/** PIX da loja, se configurado (integrantes ativos e responsáveis leem; a RLS decide). */
export async function getShopPix(): Promise<ShopPix | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("shop_settings").select("pix_key, pix_receiver, pix_city").maybeSingle();
  if (error) throw new Error(`Falha ao ler o PIX da loja: ${error.message}`);
  const row = data ? pixRow.parse(data) : null;
  return row?.pix_key && row.pix_receiver && row.pix_city ? { key: row.pix_key, receiver: row.pix_receiver, city: row.pix_city } : null;
}

/** Produtos por id, só os que a RLS libera (para montar o carrinho com preço atual). */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const valid = [...new Set(ids)].filter((id) => z.uuid().safeParse(id).success);
  if (valid.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select(COLUMNS).in("id", valid);
  if (error) throw new Error(`Falha ao ler os produtos: ${error.message}`);
  return withPhotos(z.array(productRow).parse(data ?? []));
}

/** Quem gerencia a loja: permissão `store.manage` (informada por quem chama) ou responsável designado. */
export async function isShopManager(hasStorePermission: boolean): Promise<boolean> {
  if (hasStorePermission) return true;
  const user = await getSessionUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("shop_managers").select("member_id").eq("member_id", user.id).maybeSingle();
  return Boolean(data);
}

const managerRow = z.object({ member_id: z.uuid(), display_name: z.string() });
export async function listShopManagers() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shop_list_managers");
  if (error) throw new Error(`Falha ao ler os responsáveis: ${error.message}`);
  return z.array(managerRow).parse(data ?? []);
}

export { listMemberOptions };

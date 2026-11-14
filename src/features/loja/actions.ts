"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";

import { requireActiveMember, requirePermission } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/form";
import { PERMISSIONS } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { addLine, removeLine, setLineQuantity } from "./cart-lines";
import { readCart, writeCart } from "./cart";
import { SHOP_BUCKET, getProduct, isShopManager } from "./queries";
import {
  addToCartSchema,
  cartLineFormSchema,
  checkoutSchema,
  managerSchema,
  orderIdSchema,
  pixSettingsSchema,
  productSchema,
  statusSchema,
} from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function friendly(error: { code?: string; message?: string }): string {
  if (error.code === "42501") return "Você não tem permissão para esta ação.";
  if (error.code === "P0002") return "Produto não encontrado.";
  if (error.code === "23514" && error.message && !/violates|constraint/i.test(error.message)) return error.message;
  return "Não foi possível concluir. Confira os dados e tente de novo.";
}

/** O contador do carrinho fica no cabeçalho: atualiza a página do carrinho. */
function revalidateCart() {
  revalidatePath("/carrinho");
}

function revalidateShop() {
  revalidatePath("/loja", "layout");
  revalidatePath("/pedidos", "layout");
}

async function requireShopManager() {
  const member = await requireActiveMember();
  if (!(await isShopManager(member.permissions.includes(PERMISSIONS.storeManage)))) {
    return { member, allowed: false as const };
  }
  return { member, allowed: true as const };
}

export async function saveProduct(_previous: FormState, formData: FormData): Promise<FormState> {
  const { member, allowed } = await requireShopManager();
  if (!allowed) return { status: "error", message: "Você não tem permissão para esta ação." };
  const values = {
    productId: text(formData, "productId"),
    name: text(formData, "name"),
    description: text(formData, "description"),
    price: text(formData, "price"),
    visibility: text(formData, "visibility"),
    sizes: text(formData, "sizes"),
    paymentInstructions: text(formData, "paymentInstructions"),
  };
  const parsed = productSchema.safeParse({
    ...values,
    isPublished: formData.get("isPublished") === "on",
    isAvailable: formData.get("isAvailable") === "on",
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const input = parsed.data;
  const fields = {
    name: input.name,
    description: input.description,
    price_cents: input.price,
    visibility: input.visibility,
    sizes: input.sizes,
    payment_instructions: input.paymentInstructions,
    is_published: input.isPublished,
    is_available: input.isAvailable,
  };

  const supabase = await createClient();
  if (input.productId) {
    const { data, error } = await supabase.from("products").update(fields).eq("id", input.productId).select("id");
    if (error || !data?.length) return { status: "error", message: "Não foi possível salvar o produto.", values };
    revalidateShop();
    return { status: "success", message: "Produto salvo." };
  }
  const { data, error } = await supabase
    .from("products")
    .insert({ ...fields, created_by: member.id })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: "Não foi possível criar o produto.", values };
  revalidateShop();
  redirect(`/pedidos/gestao/produtos/${data.id}?criado=1`);
}

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Foto do produto: o servidor decodifica, corrige a orientação, limita a 1024 px
 * e regrava em WebP (descarta metadados). Quem grava no storage é o cliente de
 * servidor, só depois de a RLS confirmar que a pessoa gerencia a loja.
 */
export async function saveProductPhoto(_previous: FormState, formData: FormData): Promise<FormState> {
  const { allowed } = await requireShopManager();
  if (!allowed) return { status: "error", message: "Você não tem permissão para esta ação." };
  const productId = text(formData, "productId");
  const file = formData.get("photo");
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { status: "error", message: "Produto inválido." };
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Escolha uma imagem." };
  if (file.size > MAX_UPLOAD_BYTES) return { status: "error", message: "A imagem passa de 4 MB. Escolha uma menor." };

  let image: Buffer;
  try {
    image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 50_000_000 })
      .rotate()
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { status: "error", message: "Não foi possível ler esta imagem. Use JPEG, PNG ou WebP." };
  }

  const supabase = await createClient();
  const { data: current } = await supabase.from("products").select("photo_path").eq("id", productId).maybeSingle();
  if (!current) return { status: "error", message: "Produto não encontrado." };

  const path = `${productId}/${crypto.randomUUID()}.webp`;
  const storage = createAdminClient().storage.from(SHOP_BUCKET);
  const upload = await storage.upload(path, image, { contentType: "image/webp" });
  if (upload.error) return { status: "error", message: "Não foi possível salvar a foto. Tente de novo." };

  const { data, error } = await supabase.from("products").update({ photo_path: path }).eq("id", productId).select("id");
  if (error || !data?.length) {
    await storage.remove([path]);
    return { status: "error", message: "Não foi possível salvar a foto. Tente de novo." };
  }
  if (current.photo_path) await storage.remove([current.photo_path]);
  revalidateShop();
  return { status: "success", message: "Foto atualizada." };
}

/** Coloca o produto no carrinho (cookie); a tela leva para o carrinho. */
export async function addToCart(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActiveMember();
  const values = { productId: text(formData, "productId"), quantity: text(formData, "quantity"), size: text(formData, "size") };
  const parsed = addToCartSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const { productId, quantity, size } = parsed.data;

  // O preço e a disponibilidade vêm do banco; o cookie só guarda produto, tamanho e quantidade.
  const product = await getProduct(productId);
  if (!product || !product.is_published) return { status: "error", message: "Produto não encontrado.", values };
  if (!product.is_available) return { status: "error", message: "Este produto está esgotado.", values };
  let chosen = "";
  if (product.sizes.length > 0) {
    if (!product.sizes.includes(size)) return { status: "error", fieldErrors: { size: "Escolha um tamanho." }, values };
    chosen = size;
  }
  await writeCart(addLine(await readCart(), { p: productId, s: chosen, q: quantity }));
  // Sem redirect aqui: o destino seria renderizado com o cookie antigo. A tela navega depois.
  return { status: "success", data: { href: "/carrinho" } };
}

export async function updateCartLine(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActiveMember();
  const parsed = cartLineFormSchema.safeParse({
    productId: text(formData, "productId"),
    size: text(formData, "size"),
    quantity: text(formData, "quantity"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  await writeCart(setLineQuantity(await readCart(), parsed.data.productId, parsed.data.size, parsed.data.quantity));
  revalidateCart();
  return { status: "success" };
}

export async function removeCartLine(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActiveMember();
  const parsed = cartLineFormSchema.safeParse({
    productId: text(formData, "productId"),
    size: text(formData, "size"),
    quantity: "1",
  });
  if (!parsed.success) return { status: "error", message: "Item inválido." };
  await writeCart(removeLine(await readCart(), parsed.data.productId, parsed.data.size));
  revalidateCart();
  return { status: "success" };
}

/** Transforma o carrinho em um pedido; o banco confere preço, tamanho e disponibilidade. */
export async function checkout(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActiveMember();
  const values = { note: text(formData, "note") };
  const parsed = checkoutSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const lines = await readCart();
  if (lines.length === 0) return { status: "error", message: "O carrinho está vazio.", values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shop_checkout", {
    p_items: lines.map((line) => ({ product_id: line.p, quantity: line.q, size: line.s })),
    p_note: parsed.data.note ?? "",
  });
  if (error || typeof data !== "string") return { status: "error", message: friendly(error ?? {}), values };
  await writeCart([]);
  // Sem revalidar /carrinho aqui: a página esvaziaria e o formulário sumiria antes de a tela navegar.
  revalidateShop();
  return { status: "success", data: { href: `/pedidos/${data}?novo=1` } };
}

export async function saveShopPix(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.storeManage);
  const values = { pixKey: text(formData, "pixKey"), receiver: text(formData, "receiver"), city: text(formData, "city") };
  const parsed = pixSettingsSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const supabase = await createClient();
  const { error } = await supabase.rpc("shop_set_pix", {
    p_key: parsed.data.pixKey ?? "",
    p_receiver: parsed.data.receiver ?? "",
    p_city: parsed.data.city ?? "",
  });
  if (error) return { status: "error", message: friendly(error), values };
  revalidateShop();
  return {
    status: "success",
    message: parsed.data.pixKey ? "PIX da loja salvo. Confira o QR code em um pedido de teste." : "PIX da loja desligado.",
  };
}

export async function cancelOrder(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActiveMember();
  const parsed = orderIdSchema.safeParse({ orderId: text(formData, "orderId") });
  if (!parsed.success) return { status: "error", message: "Pedido inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("shop_cancel_order", { p_order_id: parsed.data.orderId });
  if (error) return { status: "error", message: friendly(error) };
  revalidateShop();
  return { status: "success", message: "Pedido cancelado." };
}

export async function setOrderStatus(_previous: FormState, formData: FormData): Promise<FormState> {
  const { allowed } = await requireShopManager();
  if (!allowed) return { status: "error", message: "Você não tem permissão para esta ação." };
  const parsed = statusSchema.safeParse({
    orderId: text(formData, "orderId"),
    status: text(formData, "status"),
    note: text(formData, "note"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("shop_set_order_status", {
    p_order_id: parsed.data.orderId,
    p_status: parsed.data.status,
    p_note: parsed.data.note ?? "",
  });
  if (error) return { status: "error", message: friendly(error) };
  revalidateShop();
  return { status: "success", message: "Status atualizado." };
}

export async function setShopManager(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.storeManage);
  const parsed = managerSchema.safeParse({
    memberId: text(formData, "memberId"),
    active: formData.get("active") === "1",
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("shop_set_manager", {
    p_member_id: parsed.data.memberId,
    p_active: parsed.data.active,
  });
  if (error) return { status: "error", message: friendly(error) };
  revalidatePath("/pedidos", "layout");
  return { status: "success", message: parsed.data.active ? "Responsável designado." : "Responsável removido." };
}

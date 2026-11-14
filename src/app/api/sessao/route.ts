import { NextResponse } from "next/server";

import { readCart } from "@/features/loja/cart";
import { cartItemCount } from "@/features/loja/cart-lines";
import { getSessionUser } from "@/lib/auth/session";
import { readPublicEnv } from "@/lib/env";

/**
 * Estado mínimo da sessão para o cabeçalho das páginas públicas (que são pré-renderizadas):
 * se há login e quantos itens há no carrinho. Não devolve dado pessoal.
 */
export async function GET() {
  const loggedIn = readPublicEnv() ? Boolean(await getSessionUser()) : false;
  const cartCount = loggedIn ? cartItemCount(await readCart()) : 0;
  return NextResponse.json({ loggedIn, cartCount }, { headers: { "Cache-Control": "no-store" } });
}

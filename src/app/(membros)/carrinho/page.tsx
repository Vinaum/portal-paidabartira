/* eslint-disable @next/next/no-img-element -- endereço assinado e temporário. */
import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatBRL } from "@/features/caixinha/money";
import { readCart } from "@/features/loja/cart";
import { CartQuantityForm, CheckoutForm, RemoveCartLineForm } from "@/features/loja/components/cart-forms";
import { getProductsByIds, getShopPix } from "@/features/loja/queries";
import { requireActiveMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Carrinho" };

export default async function CartPage() {
  await requireActiveMember();
  const lines = await readCart();
  const [products, pix] = await Promise.all([getProductsByIds(lines.map((line) => line.p)), getShopPix()]);
  const byId = new Map(products.map((product) => [product.id, product]));

  const rows = lines.map((line) => {
    const product = byId.get(line.p);
    let problem: string | null = null;
    if (!product || !product.is_published) problem = "Este produto não está mais à venda.";
    else if (!product.is_available) problem = "Produto esgotado.";
    else if (product.sizes.length > 0 && !product.sizes.includes(line.s)) problem = "Tamanho indisponível.";
    return { line, product, problem, subtotal: product ? product.price_cents * line.q : 0 };
  });
  const blocked = rows.some((row) => row.problem !== null);
  const total = rows.reduce((sum, row) => sum + (row.problem ? 0 : row.subtotal), 0);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Loja" title="Carrinho" />
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/loja" variant="outline">Continuar comprando</ButtonLink>
        <ButtonLink href="/pedidos" variant="outline">Meus pedidos</ButtonLink>
      </div>

      {rows.length === 0 ? (
        <Notice>
          Seu carrinho está vazio. <Link href="/loja" className="font-semibold underline">Veja a loja</Link>.
        </Notice>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {rows.map(({ line, product, problem, subtotal }) => (
              <li key={`${line.p}-${line.s}`}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start gap-4">
                    {product?.photoUrl ? (
                      <img src={product.photoUrl} alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-sm border-2 border-sepia object-cover" />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-semibold">
                        {product?.name ?? "Produto indisponível"}
                        {line.s ? ` (${line.s})` : ""}
                      </h2>
                      {product ? <p>{formatBRL(product.price_cents)} cada</p> : null}
                      {problem ? <p className="font-semibold text-vinho">{problem} Remova este item para continuar.</p> : <p>Subtotal: <strong>{formatBRL(subtotal)}</strong></p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-4">
                    {!problem ? <CartQuantityForm productId={line.p} size={line.s} quantity={line.q} /> : null}
                    <RemoveCartLineForm productId={line.p} size={line.s} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <Card className="flex flex-col gap-4">
            <p className="text-2xl">
              Total: <strong>{formatBRL(total)}</strong>
            </p>
            {!pix ? (
              <Notice>
                A loja ainda não configurou o PIX. Você pode finalizar o pedido e combinar o pagamento com a tesouraria.
              </Notice>
            ) : null}
            {blocked ? <Notice>Remova os itens com problema para finalizar.</Notice> : <CheckoutForm />}
          </Card>
        </>
      )}
    </div>
  );
}

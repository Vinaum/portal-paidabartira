import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Stamp } from "@/components/ui/seal";
import { formatBRL } from "@/features/caixinha/money";
import { ProductPhoto } from "@/features/loja/components/product-card";
import { AddToCartForm } from "@/features/loja/components/cart-forms";
import { getProduct } from "@/features/loja/queries";
import { getCurrentMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Produto" };

export default function ProductPage({ params }: PageProps<"/loja/[id]">) {
  return (
    <Suspense fallback={<p>Carregando produto…</p>}>
      <Product params={params} />
    </Suspense>
  );
}

async function Product({ params }: { params: PageProps<"/loja/[id]">["params"] }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product || !product.is_published) notFound();
  const member = await getCurrentMember();
  const isMember = member?.status === "active";

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Loja" title={product.name} />
      <p>
        <Link href="/loja" className="underline underline-offset-4">
          Voltar à loja
        </Link>
      </p>
      <Card className="flex flex-wrap gap-6">
        <ProductPhoto product={product} size={240} />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-2xl font-bold">{formatBRL(product.price_cents)}</p>
          <p className="flex flex-wrap gap-2">
            {!product.is_available ? <Stamp tone="vinho">Esgotado</Stamp> : null}
            {product.visibility === "members" ? <Stamp tone="preto">Só integrantes</Stamp> : null}
          </p>
          {product.description ? <p className="whitespace-pre-line">{product.description}</p> : null}
          {product.sizes.length > 0 ? <p>Tamanhos: {product.sizes.join(", ")}</p> : null}
        </div>
      </Card>

      {!product.is_available ? (
        <Notice>Este produto está esgotado.</Notice>
      ) : isMember ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">Comprar</h2>
          <p>Adicione ao carrinho, finalize o pedido e pague com o QR code do PIX. A tesouraria confere o pagamento e entrega.</p>
          <AddToCartForm productId={product.id} sizes={product.sizes} />
          <p>
            <Link href="/carrinho" className="font-semibold underline underline-offset-4">
              Ver o carrinho
            </Link>
          </p>
        </Card>
      ) : (
        <Notice>
          Compras são feitas por integrantes.{" "}
          <Link href="/login" className="font-semibold underline">
            Entre
          </Link>{" "}
          para comprar.
        </Notice>
      )}
    </div>
  );
}

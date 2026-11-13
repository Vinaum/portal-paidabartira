import type { Metadata } from "next";
import { Suspense } from "react";

import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductCard } from "@/features/loja/components/product-card";
import { listProducts } from "@/features/loja/queries";

export const metadata: Metadata = { title: "Loja" };

/** Visitantes veem os produtos públicos; integrantes logados veem também os de integrantes (a RLS decide). */
export default function ShopPage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Portal" title="Loja" />
      <p className="max-w-prose">
        Aqui não há pagamento online: integrantes fazem o pedido e combinam o pagamento por PIX com a tesouraria.
      </p>
      <Suspense fallback={<p>Carregando produtos…</p>}>
        <Products />
      </Suspense>
    </div>
  );
}

async function Products() {
  const products = (await listProducts()).filter((product) => product.is_published);
  if (products.length === 0) return <Notice>Nenhum produto disponível no momento.</Notice>;
  return (
    <ul className="flex flex-col gap-4">
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} href={`/loja/${product.id}`} />
        </li>
      ))}
    </ul>
  );
}

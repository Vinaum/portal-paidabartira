import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductCard } from "@/features/loja/components/product-card";
import { isShopManager, listProducts } from "@/features/loja/queries";
import { requireActiveMember } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Produtos da loja" };

export default async function ShopProductsPage() {
  const member = await requireActiveMember();
  if (!(await isShopManager(member.permissions.includes(PERMISSIONS.storeManage)))) redirect("/pedidos");
  const products = await listProducts();
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Loja" title="Produtos" />
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/pedidos/gestao/produtos/novo">Novo produto</ButtonLink>
        <ButtonLink href="/pedidos/gestao" variant="outline">Pedidos</ButtonLink>
      </div>
      {products.length === 0 ? (
        <Notice>Nenhum produto cadastrado.</Notice>
      ) : (
        <ul className="flex flex-col gap-4">
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} href={`/pedidos/gestao/produtos/${product.id}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

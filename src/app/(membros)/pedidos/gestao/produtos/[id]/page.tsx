import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { centsToInput } from "@/features/caixinha/money";
import { ProductPhoto } from "@/features/loja/components/product-card";
import { ProductForm, ProductPhotoForm } from "@/features/loja/components/product-form";
import { getProduct, isShopManager } from "@/features/loja/queries";
import { requireActiveMember } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Editar produto" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/pedidos/gestao/produtos/[id]">) {
  const member = await requireActiveMember();
  if (!(await isShopManager(member.permissions.includes(PERMISSIONS.storeManage)))) redirect("/pedidos");
  const { id } = await params;
  const { criado } = await searchParams;
  const product = await getProduct(id);
  if (!product) notFound();
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Loja" title={product.name} />
      {criado === "1" ? (
        <Notice tone="success">Produto criado como rascunho. Envie a foto e marque “Publicado” quando estiver pronto.</Notice>
      ) : null}
      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Foto</h2>
        <ProductPhoto product={product} size={200} />
        <ProductPhotoForm productId={product.id} />
      </Card>
      <Card>
        <ProductForm
          product={{
            id: product.id,
            name: product.name,
            description: product.description ?? "",
            price: centsToInput(product.price_cents),
            visibility: product.visibility,
            sizes: product.sizes.join(", "),
            paymentInstructions: product.payment_instructions ?? "",
            isPublished: product.is_published,
            isAvailable: product.is_available,
          }}
        />
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductForm } from "@/features/loja/components/product-form";
import { isShopManager } from "@/features/loja/queries";
import { requireActiveMember } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  const member = await requireActiveMember();
  if (!(await isShopManager(member.permissions.includes(PERMISSIONS.storeManage)))) redirect("/pedidos");
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Loja" title="Novo produto" />
      <Card>
        <ProductForm />
      </Card>
    </div>
  );
}

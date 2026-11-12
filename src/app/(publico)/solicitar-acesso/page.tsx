import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { AccessRequestForm } from "@/features/acesso/components/access-request-form";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Solicitar acesso" };

export default function AccessRequestPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <SectionHeading as="h1" kicker="Área de integrantes" title="Solicitar acesso" />
      <p>
        A área restrita da {site.name} é para moradores, ex-moradores e pessoas agregadas à casa. Cada
        pedido é analisado pela administração da república antes da criação da conta.
      </p>
      <Card>
        <AccessRequestForm />
      </Card>
    </div>
  );
}

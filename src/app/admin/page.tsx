import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Seal } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { requireAdminAccess } from "@/lib/auth/session";
import { PERMISSION_LABELS, ROLE_LABELS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Administração" };

/**
 * Entrada do painel administrativo na Etapa 2: mostra o papel e as
 * permissões efetivas, lidas do banco. As seções (solicitações, integrantes,
 * caixinha...) entram com seus módulos na Etapa 3.
 */
export default async function AdminHomePage() {
  const member = await requireAdminAccess();

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading as="h1" kicker="Painel administrativo" title="Administração" />

      <Card className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Suas permissões</h2>
        <p>
          Papel: <Seal tone="preto">{ROLE_LABELS[member.role]}</Seal>
        </p>
        <ul className="list-disc pl-6">
          {member.permissions.map((permission) => (
            <li key={permission}>{PERMISSION_LABELS[permission]}</li>
          ))}
        </ul>
      </Card>

      <Notice>As seções de gestão chegam junto com cada módulo, na próxima etapa.</Notice>
    </div>
  );
}

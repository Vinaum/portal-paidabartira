import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Seal } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { countPendingRequests } from "@/features/acesso/queries";
import { requireAdminAccess } from "@/lib/auth/session";
import { PERMISSIONS, PERMISSION_LABELS, ROLE_LABELS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Administração" };

/**
 * Entrada do painel administrativo: atalhos das seções já disponíveis e as
 * permissões efetivas de quem está logado, lidas do banco.
 */
export default async function AdminHomePage() {
  const member = await requireAdminAccess();
  const canReview = member.permissions.includes(PERMISSIONS.requestsReview);
  const pendingRequests = canReview ? await countPendingRequests() : 0;

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading as="h1" kicker="Painel administrativo" title="Administração" />

      {canReview ? (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Solicitações de acesso</h2>
            <p>
              {pendingRequests === 0
                ? "Nenhuma aguardando análise."
                : pendingRequests === 1
                  ? "1 aguardando análise."
                  : `${pendingRequests} aguardando análise.`}
            </p>
          </div>
          <ButtonLink href="/admin/solicitacoes" variant="dark">
            Abrir solicitações
          </ButtonLink>
        </Card>
      ) : null}

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

      <Notice>As demais seções de gestão chegam junto com cada módulo.</Notice>
    </div>
  );
}

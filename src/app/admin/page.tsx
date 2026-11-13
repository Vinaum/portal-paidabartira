import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Seal } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { countOpenDataRequests } from "@/features/admin-integrantes/queries";
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
  const canManageEvents = member.permissions.includes(PERMISSIONS.eventsManage);
  const canManageFinance = member.permissions.includes(PERMISSIONS.financeWrite);
  const canManageMembers = member.permissions.includes(PERMISSIONS.membersManage);
  const canHandlePrivacy = member.permissions.includes(PERMISSIONS.privacyHandle);
  const [pendingRequests, openDataRequests] = await Promise.all([
    canReview ? countPendingRequests() : 0,
    canHandlePrivacy ? countOpenDataRequests() : 0,
  ]);

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

      {canManageEvents ? (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Eventos</h2>
            <p>Criar, publicar e cancelar eventos, e ver quem confirmou presença.</p>
          </div>
          <ButtonLink href="/admin/eventos" variant="dark">
            Abrir eventos
          </ButtonLink>
        </Card>
      ) : null}

      {canManageFinance ? (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Caixinhas</h2>
            <p>Criar caixinhas, designar responsáveis e registrar entradas e saídas.</p>
          </div>
          <ButtonLink href="/financeiro" variant="dark">
            Abrir caixinhas
          </ButtonLink>
        </Card>
      ) : null}

      {canManageMembers ? (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Integrantes</h2>
            <p>Categoria, fundador, situação, papel e histórico de cada pessoa.</p>
          </div>
          <ButtonLink href="/admin/integrantes" variant="dark">
            Abrir integrantes
          </ButtonLink>
        </Card>
      ) : null}

      {canHandlePrivacy ? (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Pedidos de dados</h2>
            <p>
              {openDataRequests === 0
                ? "Nenhum pedido em aberto."
                : openDataRequests === 1
                  ? "1 pedido em aberto."
                  : `${openDataRequests} pedidos em aberto.`}
            </p>
          </div>
          <ButtonLink href="/admin/privacidade" variant="dark">
            Abrir pedidos
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

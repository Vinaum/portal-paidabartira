import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Stamp } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { DeleteAccountForm, ResolveRequestForm } from "@/features/admin-integrantes/components/privacy-forms";
import { listDataRequests } from "@/features/admin-integrantes/queries";
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS } from "@/features/admin-integrantes/schemas";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { PERMISSIONS, ROLE_LABELS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Pedidos de dados" };

export default async function PrivacyRequestsPage({ searchParams }: PageProps<"/admin/privacidade">) {
  await requirePermission(PERMISSIONS.privacyHandle);
  const { concluido } = await searchParams;
  const requests = await listDataRequests();

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Administração" title="Pedidos de dados (LGPD)" />
      <Notice>
        Pedidos de exclusão, correção e cópia dos dados. Responda a cada pessoa por você mesmo, pelo contato que ela
        mantém; aqui fica o registro do que foi feito.
      </Notice>

      {concluido === "exclusao" ? (
        <Notice tone="success">Conta excluída. Restam apenas os registros de auditoria, sem dados pessoais.</Notice>
      ) : concluido === "sem-registro" ? (
        <Notice tone="error">
          Conta excluída, mas o registro final de auditoria falhou. Avise o responsável técnico.
        </Notice>
      ) : null}

      {requests.length === 0 ? (
        <p>Nenhum pedido recebido até agora.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {requests.map((request) => {
            const active = request.status === "open" || request.status === "in_progress";
            return (
              <li key={request.id}>
                <Card className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold">
                      {REQUEST_KIND_LABELS[request.kind]} ·{" "}
                      <Link href={`/admin/integrantes/${request.member_id}`} className="underline">
                        {request.member_name}
                      </Link>
                    </h2>
                    <Stamp tone={active ? "vinho" : "preto"}>{REQUEST_STATUS_LABELS[request.status]}</Stamp>
                  </div>
                  <p className="text-sm text-sepia-escuro">
                    Recebido em {formatDateTime(request.created_at)} · {ROLE_LABELS[request.member_role]}
                  </p>
                  {request.details ? <p className="whitespace-pre-line">“{request.details}”</p> : null}
                  {request.resolution ? (
                    <p>
                      <strong>Resposta:</strong> {request.resolution}
                      {request.handled_by_name ? ` (${request.handled_by_name}, ${formatDateTime(request.handled_at ?? request.created_at)})` : ""}
                    </p>
                  ) : null}
                  {active ? (
                    <>
                      <ResolveRequestForm requestId={request.id} inProgress={request.status === "in_progress"} />
                      {request.kind === "deletion" ? (
                        <DeleteAccountForm requestId={request.id} memberName={request.member_name} />
                      ) : null}
                    </>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

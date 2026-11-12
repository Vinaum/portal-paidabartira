import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Seal, Stamp } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  ApproveForm,
  InvitationForm,
  RejectForm,
  ReopenForm,
  RequestInfoForm,
} from "@/features/acesso/components/review-forms";
import { getAccessRequest, listInvitations } from "@/features/acesso/queries";
import { REQUEST_STATUS_LABELS } from "@/features/acesso/schemas";
import { requirePermission } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { CATEGORY_LABELS, PERMISSIONS, ROLE_LABELS, type MemberRole } from "@/lib/permissions";

export const metadata: Metadata = { title: "Solicitação" };

export default async function RequestDetailPage({ params }: PageProps<"/admin/solicitacoes/[id]">) {
  const reviewer = await requirePermission(PERMISSIONS.requestsReview);
  const { id } = await params;
  const request = await getAccessRequest(id);
  if (!request) notFound();
  const invitations = await listInvitations(request.id);

  // Só oferece os papéis que este revisor pode conceder; o banco confere de novo.
  const assignableRoles: MemberRole[] = ["membro"];
  if (reviewer.permissions.includes(PERMISSIONS.membersAssignModerator)) assignableRoles.push("moderador");
  if (reviewer.role === "superadmin") assignableRoles.push("administrador", "superadmin");

  const open = request.status === "pending" || request.status === "needs_info";

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href="/admin/solicitacoes" className="font-semibold underline">
          ← Todas as solicitações
        </Link>
      </p>
      <SectionHeading as="h1" kicker="Solicitação de acesso" title={request.full_name} />
      <div>
        <Stamp tone={open ? "vinho" : "preto"}>{REQUEST_STATUS_LABELS[request.status]}</Stamp>
      </div>

      <Card>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Item label="Apelido" value={request.nickname} />
          <Item label="E-mail" value={request.email} />
          <Item label="Telefone" value={request.phone} />
          <Item label="Recebida em" value={formatDateTime(request.created_at)} />
          <Item label="Relação com a república" value={request.relationship} wide />
          <Item label="Vínculo" value={request.justification} wide />
          <Item label="Informações adicionais" value={request.extra_info} wide />
          <Item label="Política aceita" value={`versão ${request.policy_version}`} />
        </dl>
      </Card>

      {request.info_request ? (
        <Notice>
          <strong>Informação pedida:</strong> {request.info_request}
        </Notice>
      ) : null}
      {request.admin_notes ? (
        <Notice>
          <strong>Observações internas:</strong> {request.admin_notes}
        </Notice>
      ) : null}

      {open ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="flex flex-col gap-3 lg:col-span-2">
            <h2 className="text-2xl font-semibold">Aprovar</h2>
            <ApproveForm requestId={request.id} assignableRoles={assignableRoles} />
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold">Pedir informações</h2>
            <RequestInfoForm requestId={request.id} />
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold">Rejeitar</h2>
            <RejectForm requestId={request.id} />
          </Card>
        </div>
      ) : null}

      {request.status === "approved" || request.status === "invited" ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">Convite</h2>
          <p className="flex flex-wrap items-center gap-2">
            Entrará como
            {request.assigned_category ? <Seal>{CATEGORY_LABELS[request.assigned_category]}</Seal> : null}
            {request.assigned_is_founder ? <Seal tone="vinho">Fundador</Seal> : null}
            <Seal tone="preto">{ROLE_LABELS[request.assigned_role]}</Seal>
          </p>
          {invitations.length > 0 ? (
            <p className="text-sepia-escuro">
              Último convite: {formatDateTime(invitations[0].sent_at)}
              {invitations[0].accepted_at ? " (aceito)" : " (ainda não aceito)"}
            </p>
          ) : null}
          <InvitationForm requestId={request.id} resend={request.status === "invited"} />
          {request.status === "approved" ? <ReopenForm requestId={request.id} /> : null}
        </Card>
      ) : null}

      {request.status === "activated" ? (
        <Notice tone="success">Conta criada: esta pessoa já é integrante do portal.</Notice>
      ) : null}
    </div>
  );
}

function Item({ label, value, wide = false }: { label: string; value: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="rotulo text-sepia-escuro">{label}</dt>
      <dd className="whitespace-pre-wrap break-words">{value ?? "—"}</dd>
    </div>
  );
}

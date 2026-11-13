import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Seal, Stamp } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { MemberForms } from "@/features/admin-integrantes/components/member-forms-section";
import { getAdminMember, getMemberHistory } from "@/features/admin-integrantes/queries";
import { STATUS_LABELS } from "@/features/admin-integrantes/schemas";
import { requirePermission } from "@/lib/auth/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { CATEGORY_LABELS, PERMISSIONS, ROLE_LABELS, type MemberRole } from "@/lib/permissions";

export const metadata: Metadata = { title: "Integrante" };

const FIELD_LABELS: Record<string, string> = {
  category: "Categoria",
  is_founder: "Fundador",
  role: "Papel",
  status: "Situação",
  activation: "Ativação",
};

function describe(field: string, value: string | null): string {
  if (value === null) return "—";
  if (field === "category") return CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS] ?? value;
  if (field === "role") return ROLE_LABELS[value as keyof typeof ROLE_LABELS] ?? value;
  if (field === "status") return STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? value;
  if (field === "is_founder") return value === "true" ? "sim" : "não";
  return value;
}

export default async function AdminMemberPage({ params }: PageProps<"/admin/integrantes/[id]">) {
  const viewer = await requirePermission(PERMISSIONS.membersManage);
  const { id } = await params;
  const member = await getAdminMember(id);
  if (!member) notFound();
  const history = await getMemberHistory(member.member_id);

  const isSelf = member.member_id === viewer.id;
  const isSuper = viewer.role === "superadmin";
  const canAssignModerator = viewer.permissions.includes(PERMISSIONS.membersAssignModerator);
  // O banco confere de novo; aqui só se evita oferecer o que será recusado.
  const protectedTarget = member.role === "administrador" || member.role === "superadmin";
  const canEditLink = !isSelf && (!protectedTarget || isSuper);
  const canEditRole =
    !isSelf && (member.role === "membro" || (member.role === "moderador" && canAssignModerator) || (protectedTarget && isSuper));
  const assignableRoles: MemberRole[] = ["membro"];
  if (canAssignModerator) assignableRoles.push("moderador");
  if (isSuper) assignableRoles.push("administrador", "superadmin");

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href="/admin/integrantes" className="font-semibold underline">
          ← Todos os integrantes
        </Link>
      </p>
      <SectionHeading as="h1" kicker="Integrante" title={member.display_name} />
      <div className="flex flex-wrap gap-2">
        <Seal>{CATEGORY_LABELS[member.category]}</Seal>
        {member.is_founder ? <Seal tone="vinho">Fundador</Seal> : null}
        <Seal tone="preto">{ROLE_LABELS[member.role]}</Seal>
        {member.status !== "active" ? <Stamp>{STATUS_LABELS[member.status]}</Stamp> : null}
      </div>

      <Card>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Nome completo</dt>
            <dd>{member.full_name}</dd>
          </div>
          <div>
            <dt className="font-semibold">E-mail de login</dt>
            <dd className="break-words">{member.login_email ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold">Integrante desde</dt>
            <dd>{formatDate(member.activated_at)}</dd>
          </div>
          {member.status === "active" ? (
            <div>
              <dt className="font-semibold">Perfil</dt>
              <dd>
                <Link href={`/diretorio/${member.member_id}`} className="underline">
                  Ver como integrante
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>

      {member.open_deletion_request ? (
        <Notice tone="error">
          Esta pessoa pediu a exclusão da conta.{" "}
          {viewer.permissions.includes(PERMISSIONS.privacyHandle) ? (
            <Link href="/admin/privacidade" className="font-semibold underline">
              Abrir pedidos de dados
            </Link>
          ) : (
            "A análise é feita por quem atende pedidos de dados."
          )}
        </Notice>
      ) : null}

      {isSelf ? (
        <Notice>Ninguém altera o próprio vínculo. Peça a outro administrador.</Notice>
      ) : !canEditLink ? (
        <Notice>Somente o superadmin altera administradores.</Notice>
      ) : (
        <MemberForms
          member={{
            id: member.member_id,
            category: member.category,
            isFounder: member.is_founder,
            status: member.status,
            role: member.role,
          }}
          canEditRole={canEditRole}
          assignableRoles={assignableRoles}
        />
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Histórico</h2>
        {history.length === 0 ? (
          <p>Nenhuma alteração registrada.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {history.map((entry, index) => (
              <li key={index} className="border-l-4 border-sepia pl-3">
                <p>
                  <strong>{FIELD_LABELS[entry.field] ?? entry.field}</strong>
                  {entry.field === "activation"
                    ? ""
                    : `: ${describe(entry.field, entry.old_value)} → ${describe(entry.field, entry.new_value)}`}
                </p>
                <p className="text-sm text-sepia-escuro">
                  {formatDateTime(entry.changed_at)}
                  {entry.changed_by_name ? ` · por ${entry.changed_by_name}` : ""}
                </p>
                {entry.reason ? <p className="text-sm">“{entry.reason}”</p> : null}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

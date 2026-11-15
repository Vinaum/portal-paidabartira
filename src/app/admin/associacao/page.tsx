import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Stamp } from "@/components/ui/seal";
import { DecideDueForm, DecideMemberForm } from "@/features/associacao/components/association-forms";
import { listAssociationMembers, listDues } from "@/features/associacao/queries";
import { DUE_LABELS, STATUS_LABELS } from "@/features/associacao/schemas";
import { formatBRL } from "@/features/caixinha/money";
import { requirePermission } from "@/lib/auth/session";
import { formatDate, formatMonthTitle } from "@/lib/format";
import { CATEGORY_LABELS, PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Associação: gestão" };

export default async function AdminAssociationPage() {
  await requirePermission(PERMISSIONS.associationManage);
  const [members, dues] = await Promise.all([listAssociationMembers(), listDues()]);
  const pendingMembers = members.filter((member) => member.status === "pending");
  const otherMembers = members.filter((member) => member.status !== "pending");
  const pendingDues = dues.filter((due) => due.status === "informed");
  const doneDues = dues.filter((due) => due.status !== "informed").slice(0, 30);

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading as="h1" kicker="Painel administrativo" title="Associação" />
      <div>
        <ButtonLink href="/admin/associacao/caixa" variant="outline">
          Caixa, PIX e documentos
        </ButtonLink>
      </div>

      <section aria-labelledby="adesoes" className="flex flex-col gap-4">
        <h2 id="adesoes" className="text-2xl font-semibold">Pedidos de adesão</h2>
        {pendingMembers.length === 0 ? <Notice>Nenhum pedido aguardando.</Notice> : null}
        {pendingMembers.map((member) => (
          <Card key={member.member_id} className="flex flex-col gap-3">
            <p>
              <strong>{member.display_name}</strong> · {CATEGORY_LABELS[member.category]} · pedido em {formatDate(member.requested_at)}
            </p>
            <DecideMemberForm
              memberId={member.member_id}
              options={[
                { status: "active", label: "Aprovar", primary: true },
                { status: "declined", label: "Recusar" },
              ]}
            />
          </Card>
        ))}
      </section>

      <section aria-labelledby="mensalidades" className="flex flex-col gap-4">
        <h2 id="mensalidades" className="text-2xl font-semibold">Mensalidades para conferir</h2>
        <p className="max-w-prose text-sm text-sepia-escuro">
          Confira o PIX no extrato do banco antes de confirmar. Ao confirmar, a entrada vai para o livro-caixa sem o nome de quem pagou.
        </p>
        {pendingDues.length === 0 ? <Notice>Nenhuma mensalidade aguardando conferência.</Notice> : null}
        {pendingDues.map((due) => (
          <Card key={due.id} className="flex flex-col gap-3">
            <p>
              <strong>{due.display_name}</strong> informou <strong>{formatBRL(due.amount_cents)}</strong> de{" "}
              {formatMonthTitle(due.ref_month)} em {formatDate(due.informed_at)}.
            </p>
            <DecideDueForm dueId={due.id} />
          </Card>
        ))}
        {doneDues.length > 0 ? (
          <details>
            <summary className="cursor-pointer font-semibold underline-offset-4 hover:underline">Últimas já conferidas</summary>
            <ul className="mt-2 flex flex-col divide-y divide-sepia">
              {doneDues.map((due) => (
                <li key={due.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {due.display_name} · {formatMonthTitle(due.ref_month)} · {formatBRL(due.amount_cents)}
                  </span>
                  <Stamp tone={due.status === "confirmed" ? "verde" : "vinho"}>{DUE_LABELS[due.status]}</Stamp>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section aria-labelledby="associados" className="flex flex-col gap-4">
        <h2 id="associados" className="text-2xl font-semibold">Associados</h2>
        {otherMembers.length === 0 ? <Notice>Nenhum associado ainda.</Notice> : null}
        {otherMembers.map((member) => (
          <Card key={member.member_id} className="flex flex-col gap-3">
            <p className="flex flex-wrap items-center gap-3">
              <strong>{member.display_name}</strong>
              <span>{CATEGORY_LABELS[member.category]}</span>
              <Stamp tone={member.status === "active" ? "verde" : "preto"}>{STATUS_LABELS[member.status]}</Stamp>
              {member.joined_on ? <span className="text-sm text-sepia-escuro">desde {formatDate(member.joined_on)}</span> : null}
            </p>
            {member.status === "active" ? (
              <DecideMemberForm memberId={member.member_id} options={[{ status: "left", label: "Registrar saída" }]} />
            ) : (
              <DecideMemberForm memberId={member.member_id} options={[{ status: "active", label: "Reativar", primary: true }]} />
            )}
          </Card>
        ))}
      </section>
    </div>
  );
}

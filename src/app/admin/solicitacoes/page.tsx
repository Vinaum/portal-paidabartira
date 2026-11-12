import type { Metadata } from "next";
import Link from "next/link";

import { Notice } from "@/components/ui/notice";
import { Stamp } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { listAccessRequests } from "@/features/acesso/queries";
import { REQUEST_STATUSES, REQUEST_STATUS_LABELS, type RequestStatus } from "@/features/acesso/schemas";
import { formatDate } from "@/lib/format";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Solicitações de acesso" };

const statusTone: Record<RequestStatus, "verde" | "preto" | "vinho"> = {
  pending: "vinho",
  needs_info: "vinho",
  approved: "preto",
  invited: "preto",
  activated: "verde",
  rejected: "preto",
};

export default async function RequestsPage({ searchParams }: PageProps<"/admin/solicitacoes">) {
  await requirePermission(PERMISSIONS.requestsReview);
  const { status: rawStatus } = await searchParams;
  const status = REQUEST_STATUSES.find((value) => value === rawStatus);
  const requests = await listAccessRequests(status);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Administração" title="Solicitações de acesso" />

      <nav aria-label="Filtrar por situação" className="flex flex-wrap gap-x-4 gap-y-2">
        <FilterLink href="/admin/solicitacoes" active={!status}>
          Todas
        </FilterLink>
        {REQUEST_STATUSES.map((value) => (
          <FilterLink key={value} href={`/admin/solicitacoes?status=${value}`} active={status === value}>
            {REQUEST_STATUS_LABELS[value]}
          </FilterLink>
        ))}
      </nav>

      {requests.length === 0 ? (
        <Notice>Nenhuma solicitação {status ? "nesta situação" : "recebida até agora"}.</Notice>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href={`/admin/solicitacoes/${request.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-sepia bg-papel p-4 hover:border-preto"
              >
                <span>
                  <span className="block text-lg font-semibold">{request.full_name}</span>
                  <span className="text-sepia-escuro">
                    {request.relationship} · {formatDate(request.created_at)}
                  </span>
                </span>
                <Stamp tone={statusTone[request.status]}>{REQUEST_STATUS_LABELS[request.status]}</Stamp>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={active ? "font-bold underline underline-offset-4" : "underline-offset-4 hover:underline"}
    >
      {children}
    </Link>
  );
}

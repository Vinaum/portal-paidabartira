import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { SelectField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { Seal, Stamp } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { TextField } from "@/components/ui/text-field";
import { listMembers } from "@/features/admin-integrantes/queries";
import { STATUS_LABELS, memberListSearch, parseMemberListFilters } from "@/features/admin-integrantes/schemas";
import { requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import {
  CATEGORY_LABELS,
  MEMBER_CATEGORIES,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  PERMISSIONS,
  ROLE_LABELS,
} from "@/lib/permissions";

export const metadata: Metadata = { title: "Integrantes" };

export default async function AdminMembersPage({ searchParams }: PageProps<"/admin/integrantes">) {
  await requirePermission(PERMISSIONS.membersManage);
  const filters = parseMemberListFilters(await searchParams);
  const { members, total, page, pages } = await listMembers(filters);
  const filtered = Object.entries(filters).some(([key, value]) => key !== "pagina" && value !== undefined);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Administração" title="Integrantes" />

      <form method="get" action="/admin/integrantes" role="search" className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField name="q" type="search" label="Nome ou apelido" defaultValue={filters.q ?? ""} maxLength={80} />
          <SelectField name="situacao" label="Situação" defaultValue={filters.situacao ?? ""}>
            <option value="">Todas</option>
            {MEMBER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </SelectField>
          <SelectField name="categoria" label="Categoria" defaultValue={filters.categoria ?? ""}>
            <option value="">Todas</option>
            {MEMBER_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </SelectField>
          <SelectField name="papel" label="Papel" defaultValue={filters.papel ?? ""}>
            <option value="">Todos</option>
            {MEMBER_ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-sm bg-verde px-5 py-2 font-semibold text-creme hover:bg-musgo"
          >
            Filtrar
          </button>
          {filtered ? (
            <ButtonLink href="/admin/integrantes" variant="outline">
              Limpar filtros
            </ButtonLink>
          ) : null}
        </div>
      </form>

      <p className="text-sepia-escuro" aria-live="polite">
        {total === 0 ? "Nenhum integrante encontrado." : `${total} ${total === 1 ? "integrante" : "integrantes"}.`}
      </p>

      {members.length === 0 ? (
        <Notice>Ajuste os filtros para ver outros integrantes.</Notice>
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((member) => (
            <li key={member.member_id}>
              <Link
                href={`/admin/integrantes/${member.member_id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-sepia bg-papel p-4 hover:border-preto"
              >
                <span>
                  <span className="block text-lg font-semibold">{member.display_name}</span>
                  <span className="text-sepia-escuro">
                    {member.full_name} · desde {formatDate(member.activated_at)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <Seal>{CATEGORY_LABELS[member.category]}</Seal>
                  {member.is_founder ? <Seal tone="vinho">Fundador</Seal> : null}
                  {member.role !== "membro" ? <Seal tone="preto">{ROLE_LABELS[member.role]}</Seal> : null}
                  {member.status !== "active" ? <Stamp>{STATUS_LABELS[member.status]}</Stamp> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Páginas" className="flex items-center justify-between gap-4">
          {page > 1 ? (
            <Link href={`/admin/integrantes${memberListSearch(filters, page - 1)}`} className="font-semibold underline">
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span>
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link href={`/admin/integrantes${memberListSearch(filters, page + 1)}`} className="font-semibold underline">
              Próxima →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

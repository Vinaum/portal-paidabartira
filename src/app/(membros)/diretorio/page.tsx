import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { DirectoryFiltersForm } from "@/features/diretorio/components/directory-filters";
import { MemberCard } from "@/features/diretorio/components/member-card";
import { searchDirectory } from "@/features/diretorio/queries";
import { filtersToSearch, hasActiveFilters, parseDirectoryFilters } from "@/features/diretorio/schemas";
import { requireActiveMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Diretório" };

export default async function DirectoryPage({ searchParams }: PageProps<"/diretorio">) {
  await requireActiveMember();
  const filters = parseDirectoryFilters(await searchParams);
  const { entries, total, page, pages } = await searchDirectory(filters);

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading as="h1" kicker="Área de integrantes" title="Diretório" />
      <Card>
        <DirectoryFiltersForm filters={filters} />
      </Card>

      <section aria-live="polite" className="flex flex-col gap-4">
        <p className="text-sepia-escuro">
          {total === 0
            ? "Nenhum integrante encontrado."
            : `${total} ${total === 1 ? "integrante" : "integrantes"}${hasActiveFilters(filters) ? " com estes filtros" : ""}.`}
        </p>
        {entries.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {entries.map((entry) => (
              <MemberCard key={entry.member_id} entry={entry} />
            ))}
          </ul>
        ) : (
          <Notice>
            Só aparecem dados que cada pessoa deixou visíveis a integrantes. Se um filtro não encontra alguém que
            você conhece, essa pessoa pode ter escolhido não exibir aquele dado.
          </Notice>
        )}
      </section>

      {pages > 1 ? (
        <nav aria-label="Páginas do diretório" className="flex items-center justify-between gap-4">
          {page > 1 ? (
            <Link href={`/diretorio${filtersToSearch(filters, page - 1)}`} className="font-semibold underline">
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span>
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link href={`/diretorio${filtersToSearch(filters, page + 1)}`} className="font-semibold underline">
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

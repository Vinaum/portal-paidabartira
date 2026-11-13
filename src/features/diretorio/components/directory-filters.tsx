import { ButtonLink } from "@/components/ui/button";
import { SelectField } from "@/components/ui/form-fields";
import { TextField } from "@/components/ui/text-field";
import { CATEGORY_LABELS, MEMBER_CATEGORIES } from "@/lib/permissions";

import type { DirectoryFilters } from "../schemas";
import { hasActiveFilters } from "../schemas";

/**
 * Formulário GET: os filtros vão para a URL, então a busca funciona sem
 * JavaScript, pode ser compartilhada e volta com o botão "voltar".
 */
export function DirectoryFiltersForm({ filters }: { filters: DirectoryFilters }) {
  const active = hasActiveFilters(filters);
  const advancedActive = Object.entries(filters).some(
    ([key, value]) => key !== "q" && key !== "pagina" && value !== undefined,
  );
  return (
    <form method="get" action="/diretorio" className="flex flex-col gap-4" role="search">
      <TextField
        name="q"
        type="search"
        label="Nome ou apelido"
        defaultValue={filters.q ?? ""}
        maxLength={80}
        autoComplete="off"
      />
      <details open={advancedActive}>
        <summary className="cursor-pointer font-semibold underline-offset-4 hover:underline">Mais filtros</summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField name="categoria" label="Categoria" defaultValue={filters.categoria ?? ""}>
            <option value="">Todas</option>
            {MEMBER_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </SelectField>
          <SelectField name="fundadores" label="Fundadores" defaultValue={filters.fundadores ?? ""}>
            <option value="">Todos</option>
            <option value="1">Só fundadores</option>
          </SelectField>
          <TextField name="morou" label="Morou na casa em (ano)" inputMode="numeric" maxLength={4} defaultValue={filters.morou ?? ""} />
          <TextField name="formatura" label="Ano de conclusão" inputMode="numeric" maxLength={4} defaultValue={filters.formatura ?? ""} />
          <TextField name="curso" label="Curso" defaultValue={filters.curso ?? ""} maxLength={80} />
          <TextField name="instituicao" label="Faculdade" defaultValue={filters.instituicao ?? ""} maxLength={80} />
          <TextField name="profissao" label="Profissão ou área" defaultValue={filters.profissao ?? ""} maxLength={80} />
          <TextField name="empresa" label="Empresa" defaultValue={filters.empresa ?? ""} maxLength={80} />
          <TextField name="cidade" label="Cidade" defaultValue={filters.cidade ?? ""} maxLength={80} />
          <TextField name="pais" label="País" defaultValue={filters.pais ?? ""} maxLength={80} />
        </div>
      </details>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-sm bg-verde px-5 py-2 font-semibold text-creme hover:bg-musgo"
        >
          Buscar
        </button>
        {active ? (
          <ButtonLink href="/diretorio" variant="outline">
            Limpar filtros
          </ButtonLink>
        ) : null}
      </div>
    </form>
  );
}

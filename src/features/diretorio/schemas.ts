import { z } from "zod";

import { MEMBER_CATEGORIES } from "@/lib/permissions";

export const PAGE_SIZE = 24;

type RawParams = Record<string, string | string[] | undefined>;

const text = z
  .string()
  .trim()
  .max(80)
  .transform((value) => value || undefined);
const year = z
  .string()
  .trim()
  .regex(/^\d{4}$/)
  .transform(Number)
  .pipe(z.number().int().min(1950).max(2100));

/** Filtro vindo da URL. Valor inválido é ignorado, nunca vira erro de página. */
const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

const filtersSchema = z.object({
  q: lenient(text),
  categoria: lenient(z.enum(MEMBER_CATEGORIES)),
  fundadores: lenient(z.literal("1")),
  curso: lenient(text),
  instituicao: lenient(text),
  formatura: lenient(year),
  morou: lenient(year),
  profissao: lenient(text),
  empresa: lenient(text),
  cidade: lenient(text),
  pais: lenient(text),
  pagina: lenient(
    z
      .string()
      .regex(/^\d{1,4}$/)
      .transform(Number)
      .pipe(z.number().int().min(1)),
  ),
});

export type DirectoryFilters = z.infer<typeof filtersSchema>;

/** Lê os parâmetros da URL (primeiro valor de cada chave) e valida. */
export function parseDirectoryFilters(raw: RawParams): DirectoryFilters {
  const first = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  return filtersSchema.parse(first);
}

/** Há algum filtro (além da página) aplicado? */
export function hasActiveFilters(filters: DirectoryFilters): boolean {
  return Object.entries(filters).some(([key, value]) => key !== "pagina" && value !== undefined);
}

/** Monta a query string de uma página, preservando os filtros. */
export function filtersToSearch(filters: DirectoryFilters, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key === "pagina" || value === undefined) continue;
    params.set(key, String(value));
  }
  if (page > 1) params.set("pagina", String(page));
  const search = params.toString();
  return search ? `?${search}` : "";
}

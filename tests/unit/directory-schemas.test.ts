import { describe, expect, it } from "vitest";

import { filtersToSearch, hasActiveFilters, parseDirectoryFilters } from "@/features/diretorio/schemas";
import { formatPeriodYears } from "@/lib/format";

describe("diretório: filtros da URL", () => {
  it("aceita valores válidos e apara o texto", () => {
    const filters = parseDirectoryFilters({ q: "  José ", categoria: "ex_morador", morou: "2009", fundadores: "1" });
    expect(filters).toMatchObject({ q: "José", categoria: "ex_morador", morou: 2009, fundadores: "1" });
  });

  it("ignora valor inválido em vez de falhar", () => {
    const filters = parseDirectoryFilters({ categoria: "root", morou: "20x9", formatura: "1800", pagina: "0", fundadores: "sim" });
    expect(filters).toEqual({});
    expect(hasActiveFilters(filters)).toBe(false);
  });

  it("texto vazio ou longo demais não vira filtro", () => {
    expect(parseDirectoryFilters({ q: "   ", empresa: "a".repeat(81) })).toEqual({});
  });

  it("usa o primeiro valor quando a chave se repete", () => {
    expect(parseDirectoryFilters({ q: ["ana", "bia"] }).q).toBe("ana");
  });

  it("a página sozinha não conta como filtro", () => {
    expect(hasActiveFilters(parseDirectoryFilters({ pagina: "3" }))).toBe(false);
    expect(hasActiveFilters(parseDirectoryFilters({ cidade: "Campinas" }))).toBe(true);
  });

  it("monta a query string preservando filtros e a página", () => {
    const filters = parseDirectoryFilters({ q: "ana maria", pagina: "2" });
    expect(filtersToSearch(filters, 3)).toBe("?q=ana+maria&pagina=3");
    expect(filtersToSearch(filters, 1)).toBe("?q=ana+maria");
    expect(filtersToSearch({}, 1)).toBe("");
  });
});

describe("formato curto de período", () => {
  it("usa anos e 'hoje' para períodos abertos", () => {
    expect(formatPeriodYears("2007-03-01", "2010-07-01")).toBe("2007–2010");
    expect(formatPeriodYears("2011-05-01", null)).toBe("2011–hoje");
    expect(formatPeriodYears("2011-05-01", "2011-12-01")).toBe("2011");
  });
});

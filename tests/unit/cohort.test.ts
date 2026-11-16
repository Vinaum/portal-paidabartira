import { describe, expect, it } from "vitest";

import { entryYearTag, parseEntryYear } from "@/lib/cohort";

const now = new Date("2026-11-15T12:00:00Z");

describe("turma (ano de ingresso)", () => {
  it("aceita dois ou quatro dígitos", () => {
    expect(parseEntryYear("06", now)).toBe(2006);
    expect(parseEntryYear("2006", now)).toBe(2006);
    expect(parseEntryYear("’06", now)).toBe(2006);
    expect(parseEntryYear("00", now)).toBe(2000);
    expect(parseEntryYear("50", now)).toBe(1950);
    expect(parseEntryYear("99", now)).toBe(1999);
  });
  it("vira século pela regra 00–49 → 2000, 50–99 → 1900", () => {
    expect(parseEntryYear("26", now)).toBe(2026);
    expect(parseEntryYear("49", now)).toBeNull(); // 2049 ainda não existe
  });
  it("aceita o ano que vem, mas não depois", () => {
    expect(parseEntryYear("2027", now)).toBe(2027);
    expect(parseEntryYear("2028", now)).toBeNull();
  });
  it("recusa lixo e anos antigos demais", () => {
    for (const bad of ["", "6", "206", "20066", "abc", "06a", "1949", "-6"]) expect(parseEntryYear(bad, now)).toBeNull();
  });
  it("etiqueta curta com dois dígitos", () => {
    expect(entryYearTag(2006)).toBe("’06");
    expect(entryYearTag(2009)).toBe("’09");
    expect(entryYearTag(1999)).toBe("’99");
    expect(entryYearTag(2000)).toBe("’00");
  });
});

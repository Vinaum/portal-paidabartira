import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  MAX_DOCUMENT_BYTES,
  checkPdf,
  documentSchema,
  dueSchema,
  entrySchema,
  settingsSchema,
} from "@/features/associacao/schemas";
import { PERMISSIONS } from "@/lib/permissions";
import { isProtectedPath } from "@/lib/routes";

const bytes = (text: string, size = text.length) => {
  const array = new Uint8Array(size);
  array.set(new TextEncoder().encode(text));
  return array;
};

describe("mensalidade", () => {
  it("converte o mês para o primeiro dia e o valor para centavos", () => {
    expect(dueSchema.parse({ month: "2026-11", amount: "50,00" })).toEqual({ month: "2026-11-01", amount: 5000 });
  });
  it("recusa mês mal formado e valor inválido", () => {
    expect(dueSchema.safeParse({ month: "2026-13", amount: "50" }).success).toBe(false);
    expect(dueSchema.safeParse({ month: "novembro", amount: "50" }).success).toBe(false);
    expect(dueSchema.safeParse({ month: "2026-11", amount: "-5" }).success).toBe(false);
    expect(dueSchema.safeParse({ month: "2026-11", amount: "0" }).success).toBe(false);
  });
});

describe("livro-caixa", () => {
  const base = { amount: "10,00", occurredOn: "2026-11-10", description: "Faxina" };
  it("exige categoria só para saída", () => {
    expect(entrySchema.safeParse({ ...base, kind: "income", category: "" }).success).toBe(true);
    expect(entrySchema.safeParse({ ...base, kind: "expense", category: "" }).success).toBe(false);
    expect(entrySchema.safeParse({ ...base, kind: "expense", category: "Contas" }).success).toBe(true);
  });
  it("recusa tipo desconhecido", () => {
    expect(entrySchema.safeParse({ ...base, kind: "transfer", category: "x" }).success).toBe(false);
  });
});

describe("configuração do PIX", () => {
  it("aceita vazio e normaliza a chave", () => {
    expect(settingsSchema.parse({ pixKey: "", pixHolder: "", pixInstructions: "", monthly: "" })).toEqual({
      pixKey: null,
      pixHolder: null,
      pixInstructions: null,
      monthly: null,
    });
    expect(settingsSchema.parse({ pixKey: "Tesouraria@Exemplo.com", pixHolder: "X", pixInstructions: "", monthly: "25" }).pixKey).toBe(
      "tesouraria@exemplo.com",
    );
  });
  it("recusa chave irreconhecível", () => {
    expect(settingsSchema.safeParse({ pixKey: "abc", pixHolder: "", pixInstructions: "", monthly: "" }).success).toBe(false);
  });
});

describe("documento em PDF", () => {
  it("só aceita PDF de verdade e dentro do limite", () => {
    expect(checkPdf(bytes("%PDF-1.7 conteudo"))).toBeNull();
    expect(checkPdf(bytes("MZ executavel"))).not.toBeNull();
    expect(checkPdf(new Uint8Array())).not.toBeNull();
    expect(checkPdf(bytes("%PDF-1.7", MAX_DOCUMENT_BYTES + 1))).not.toBeNull();
    expect(checkPdf(bytes("%PDF-1.7", MAX_DOCUMENT_BYTES))).toBeNull();
  });
  it("valida os metadados", () => {
    expect(documentSchema.safeParse({ kind: "ata", title: "Ata de 2026", description: "", docDate: "2026-11-01" }).success).toBe(true);
    expect(documentSchema.safeParse({ kind: "ata", title: "ab", description: "", docDate: "2026-11-01" }).success).toBe(false);
    expect(documentSchema.safeParse({ kind: "video", title: "Ata de 2026", description: "", docDate: "2026-11-01" }).success).toBe(false);
  });
});

describe("integração com o restante do portal", () => {
  it("/associacao exige sessão", () => {
    expect(isProtectedPath("/associacao")).toBe(true);
    expect(isProtectedPath("/admin/associacao/caixa")).toBe(true);
  });
  it("a permissão existe no banco", () => {
    expect(PERMISSIONS.associationManage).toBe("association.manage");
    expect(readFileSync("supabase/migrations/20261126000100_association.sql", "utf8")).toContain("'association.manage'");
  });
  it("o bucket de documentos só aceita PDF", () => {
    const sql = readFileSync("supabase/migrations/20261126000100_association.sql", "utf8");
    expect(sql).toMatch(/'association-media', 'association-media', false, 8388608, array\['application\/pdf'\]/);
  });
});

describe("datas do calendário", () => {
  it("data sem hora não recua um dia por causa do fuso", async () => {
    const { formatDate, formatMonthTitle } = await import("@/lib/format");
    expect(formatDate("2026-11-15")).toMatch(/^15 de nov\.? de 2026$/);
    expect(formatDate("2026-11-15T01:00:00Z")).toMatch(/^14 de nov/); // instante: Brasília ainda é dia 14
    expect(formatMonthTitle("2026-11-01")).toBe("Novembro de 2026");
  });
});

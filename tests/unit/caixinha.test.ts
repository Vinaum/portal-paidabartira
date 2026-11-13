import { describe, expect, it } from "vitest";

import { centsToInput, formatBRL, parseBRL } from "@/features/caixinha/money";
import { entrySchema, fundSchema } from "@/features/caixinha/schemas";

describe("parseBRL", () => {
  it("aceita formatos comuns", () => {
    expect(parseBRL("1.234,56")).toBe(123456);
    expect(parseBRL("1234.56")).toBe(123456);
    expect(parseBRL("R$ 50")).toBe(5000);
    expect(parseBRL("0,05")).toBe(5);
  });
  it("recusa zero, negativo, 3 casas e lixo", () => {
    for (const bad of ["0", "-5", "1,234", "abc", "", "1e3", "99999999999999"]) {
      expect(parseBRL(bad)).toBeNull();
    }
  });
  it("formata e reconverte sem erro de ponto flutuante", () => {
    expect(formatBRL(123456).replace(/\s/g, " ")).toContain("1.234,56");
    expect(parseBRL(centsToInput(123456))).toBe(123456);
    expect(parseBRL(centsToInput(10))).toBe(10);
  });
});

describe("entrySchema", () => {
  const schema = entrySchema("2026-11-13");
  const base = { fundId: "11111111-1111-4111-8111-111111111111", kind: "expense", amount: "10,00", occurredOn: "2026-11-13", category: "Contas", description: "Conta de luz" };
  it("aceita saída válida", () => {
    expect(schema.safeParse(base).success).toBe(true);
  });
  it("exige categoria na saída e a descarta na entrada", () => {
    expect(schema.safeParse({ ...base, category: "" }).success).toBe(false);
    const income = schema.safeParse({ ...base, kind: "income", category: "Contas" });
    expect(income.success && income.data.category).toBeNull();
  });
  it("recusa data futura e valor inválido", () => {
    expect(schema.safeParse({ ...base, occurredOn: "2026-11-14" }).success).toBe(false);
    expect(schema.safeParse({ ...base, amount: "0" }).success).toBe(false);
  });
});

describe("fundSchema", () => {
  it("meta é opcional e convertida em centavos", () => {
    const parsed = fundSchema.safeParse({ fundId: "", name: "Casa própria", description: "", goal: "50.000,00", visibility: "members", pixKey: "", pixHolder: "", pixInstructions: "", isActive: true });
    expect(parsed.success && parsed.data.goal).toBe(5000000);
  });
});

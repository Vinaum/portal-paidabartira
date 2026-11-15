import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { POLICY_VERSION } from "@/features/acesso/schemas";
import { interestSchema, vacancySchema } from "@/features/vagas/schemas";
import { PERMISSIONS } from "@/lib/permissions";
import { isProtectedPath } from "@/lib/routes";

const interest = {
  vacancyId: "11111111-1111-4111-8111-111111111111",
  name: "Maria Candidata",
  email: " Maria@Exemplo.com ",
  phone: "",
  course: "Engenharia",
  message: "",
  consent: "on",
};

describe("interesse em vaga", () => {
  it("normaliza o e-mail e transforma vazios em nulo", () => {
    const parsed = interestSchema.parse(interest);
    expect(parsed.email).toBe("maria@exemplo.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.message).toBeNull();
  });
  it("exige aceite da política, e-mail válido e nome", () => {
    expect(interestSchema.safeParse({ ...interest, consent: undefined }).success).toBe(false);
    expect(interestSchema.safeParse({ ...interest, email: "sem-arroba" }).success).toBe(false);
    expect(interestSchema.safeParse({ ...interest, name: "Al" }).success).toBe(false);
    expect(interestSchema.safeParse({ ...interest, vacancyId: "x" }).success).toBe(false);
  });
  it("respeita os limites de tamanho do banco", () => {
    expect(interestSchema.safeParse({ ...interest, message: "a".repeat(1001) }).success).toBe(false);
    expect(interestSchema.safeParse({ ...interest, phone: "9".repeat(31) }).success).toBe(false);
  });
});

describe("vaga", () => {
  const base = { vacancyId: null, title: "Quarto individual", description: "Quarto com janela e armário.", monthly: "850,00", availableFrom: "2026-12-01" };
  it("converte valor para centavos e aceita campos opcionais vazios", () => {
    expect(vacancySchema.parse(base).monthly).toBe(85000);
    const empty = vacancySchema.parse({ ...base, monthly: "", availableFrom: "" });
    expect(empty.monthly).toBeNull();
    expect(empty.availableFrom).toBeNull();
  });
  it("recusa título curto, valor inválido e data mal formada", () => {
    expect(vacancySchema.safeParse({ ...base, title: "ab" }).success).toBe(false);
    expect(vacancySchema.safeParse({ ...base, monthly: "0" }).success).toBe(false);
    expect(vacancySchema.safeParse({ ...base, availableFrom: "01/12/2026" }).success).toBe(false);
  });
});

describe("integração", () => {
  it("a gestão exige sessão e a página pública não", () => {
    expect(isProtectedPath("/admin/vagas")).toBe(true);
    expect(isProtectedPath("/vagas")).toBe(false);
    expect(isProtectedPath("/vagas/abc")).toBe(false);
  });
  it("a permissão e a versão da política existem no banco", () => {
    expect(PERMISSIONS.vacanciesManage).toBe("vacancies.manage");
    expect(readFileSync("supabase/migrations/20261127000100_vacancies.sql", "utf8")).toContain("'vacancies.manage'");
    expect(readFileSync("supabase/migrations/20261127000200_privacy_policy_v6.sql", "utf8")).toContain(`'${POLICY_VERSION}'`);
  });
});

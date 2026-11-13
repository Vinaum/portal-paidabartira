import { describe, expect, it } from "vitest";

import {
  deleteAccountSchema,
  memberListSearch,
  parseMemberListFilters,
  resolveRequestSchema,
  setRoleSchema,
  updateMemberSchema,
} from "@/features/admin-integrantes/schemas";

const id = "aaaaaaaa-0000-4000-8000-000000000001";

describe("admin: filtros da lista", () => {
  it("ignora valores inválidos", () => {
    expect(parseMemberListFilters({ situacao: "banido", papel: "root", pagina: "0" })).toEqual({});
  });
  it("aceita valores válidos e preserva na paginação", () => {
    const filters = parseMemberListFilters({ q: " ana ", situacao: "suspended", pagina: "2" });
    expect(filters).toMatchObject({ q: "ana", situacao: "suspended", pagina: 2 });
    expect(memberListSearch(filters, 3)).toBe("?q=ana&situacao=suspended&pagina=3");
  });
});

describe("admin: alterar integrante", () => {
  const base = { memberId: id, category: "ex_morador", isFounder: true, status: "active", reason: "" };
  it("aceita fundador ex-morador e transforma motivo vazio em nulo", () => {
    const parsed = updateMemberSchema.parse(base);
    expect(parsed.reason).toBeNull();
  });
  it("recusa fundador que não é ex-morador", () => {
    const result = updateMemberSchema.safeParse({ ...base, category: "agregado" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["isFounder"]);
  });
  it("recusa situação e id inválidos", () => {
    expect(updateMemberSchema.safeParse({ ...base, status: "banido" }).success).toBe(false);
    expect(updateMemberSchema.safeParse({ ...base, memberId: "x" }).success).toBe(false);
  });
  it("recusa papel desconhecido", () => {
    expect(setRoleSchema.safeParse({ memberId: id, role: "root", reason: "" }).success).toBe(false);
    expect(setRoleSchema.safeParse({ memberId: id, role: "moderador", reason: "" }).success).toBe(true);
  });
});

describe("admin: pedidos de dados", () => {
  it("atendido ou recusado exige resposta; em análise não", () => {
    expect(resolveRequestSchema.safeParse({ requestId: id, status: "done", resolution: "  " }).success).toBe(false);
    expect(resolveRequestSchema.safeParse({ requestId: id, status: "rejected", resolution: "Sem vínculo." }).success).toBe(true);
    expect(resolveRequestSchema.safeParse({ requestId: id, status: "in_progress", resolution: "" }).success).toBe(true);
  });
  it("não aceita voltar a 'aberto'", () => {
    expect(resolveRequestSchema.safeParse({ requestId: id, status: "open", resolution: "x" }).success).toBe(false);
  });
  it("exclusão exige digitar EXCLUIR", () => {
    expect(deleteAccountSchema.safeParse({ requestId: id, confirmation: "excluir" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ requestId: id, confirmation: "EXCLUIR" }).success).toBe(true);
  });
});

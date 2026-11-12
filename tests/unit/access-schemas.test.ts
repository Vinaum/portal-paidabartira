import { describe, expect, it } from "vitest";

import { accessRequestSchema, invitationSchema, reviewRequestSchema } from "@/features/acesso/schemas";

const valid = {
  fullName: "Fulana de Tal",
  nickname: "",
  email: " Fulana@Example.com ",
  phone: "",
  relationship: "Ex-moradora",
  justification: "Morei na casa entre 2009 e 2012.",
  extraInfo: "",
  consent: "on",
};
const id = "10000000-0000-4000-8000-000000000001";

describe("accessRequestSchema", () => {
  it("normaliza e-mail e transforma opcionais vazios em null", () => {
    const parsed = accessRequestSchema.parse(valid);
    expect(parsed.email).toBe("fulana@example.com");
    expect(parsed.nickname).toBeNull();
    expect(parsed.phone).toBeNull();
  });

  it("exige o aceite da política", () => {
    expect(accessRequestSchema.safeParse({ ...valid, consent: null }).success).toBe(false);
  });

  it("recusa justificativa curta e nome curto", () => {
    expect(accessRequestSchema.safeParse({ ...valid, justification: "oi" }).success).toBe(false);
    expect(accessRequestSchema.safeParse({ ...valid, fullName: "A" }).success).toBe(false);
  });

  it("ignora campos que o visitante não pode definir", () => {
    const parsed = accessRequestSchema.parse({ ...valid, role: "superadmin", isFounder: true });
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("isFounder");
  });
});

describe("reviewRequestSchema", () => {
  it("aprovação exige categoria válida", () => {
    const base = { action: "approve", requestId: id, isFounder: false, role: "membro", adminNotes: "" };
    expect(reviewRequestSchema.safeParse(base).success).toBe(false);
    expect(reviewRequestSchema.safeParse({ ...base, category: "dono" }).success).toBe(false);
    expect(reviewRequestSchema.safeParse({ ...base, category: "ex_morador" }).success).toBe(true);
  });

  it("recusa ação desconhecida e papel inexistente", () => {
    expect(reviewRequestSchema.safeParse({ action: "delete", requestId: id, adminNotes: "" }).success).toBe(false);
    expect(
      reviewRequestSchema.safeParse({
        action: "approve", requestId: id, category: "agregado", isFounder: false, role: "dono", adminNotes: "",
      }).success,
    ).toBe(false);
  });

  it("pedido de informações exige texto", () => {
    expect(
      reviewRequestSchema.safeParse({ action: "request_info", requestId: id, infoRequest: "", adminNotes: "" }).success,
    ).toBe(false);
  });
});

describe("invitationSchema", () => {
  it("só aceita os modos previstos e um id válido", () => {
    expect(invitationSchema.safeParse({ requestId: id, mode: "link" }).success).toBe(true);
    expect(invitationSchema.safeParse({ requestId: id, mode: "sms" }).success).toBe(false);
    expect(invitationSchema.safeParse({ requestId: "1", mode: "email" }).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { announcementSchema } from "@/features/comunicados/schemas";
import { commentSchema, storySchema } from "@/features/historias/schemas";

describe("announcementSchema", () => {
  const base = { announcementId: "", title: "Festa", body: "Sábado às 20h", visibility: "public", isPinned: false, expiresOn: "" };
  it("aceita comunicado válido e converte vazio em nulo", () => {
    const parsed = announcementSchema.safeParse(base);
    expect(parsed.success && parsed.data.expiresOn).toBeNull();
  });
  it("recusa data inválida e visibilidade desconhecida", () => {
    expect(announcementSchema.safeParse({ ...base, expiresOn: "2026-02-30" }).success).toBe(false);
    expect(announcementSchema.safeParse({ ...base, visibility: "todos" }).success).toBe(false);
  });
  it("aceita data futura", () => {
    expect(announcementSchema.safeParse({ ...base, expiresOn: "2030-01-01" }).success).toBe(true);
  });
});

describe("storySchema", () => {
  it("exige texto mínimo e aceita época opcional", () => {
    expect(storySchema.safeParse({ storyId: "", title: "Mudança", body: "curto", era: "" }).success).toBe(false);
    const ok = storySchema.safeParse({ storyId: "", title: "Mudança", body: "Chegamos com um sofá.", era: " 2007 " });
    expect(ok.success && ok.data.era).toBe("2007");
  });
});

describe("commentSchema", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("limita o tamanho", () => {
    expect(commentSchema.safeParse({ storyId: id, body: "  " }).success).toBe(false);
    expect(commentSchema.safeParse({ storyId: id, body: "a".repeat(501) }).success).toBe(false);
    expect(commentSchema.safeParse({ storyId: id, body: "Fui nesse!" }).success).toBe(true);
  });
});

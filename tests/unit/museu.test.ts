import { describe, expect, it } from "vitest";

import { albumSchema, hideSchema, photoSchema } from "@/features/museu/schemas";

const base = { albumId: "", title: "Festa de 2008", description: "", year: "2008", visibility: "members" };

describe("albumSchema", () => {
  it("aceita um álbum completo e normaliza vazios", () => {
    const parsed = albumSchema.parse(base);
    expect(parsed.albumId).toBeNull();
    expect(parsed.description).toBeNull();
    expect(parsed.year).toBe(2008);
  });

  it("aceita álbum sem ano", () => {
    expect(albumSchema.parse({ ...base, year: "" }).year).toBeNull();
  });

  it("recusa ano fora do intervalo ou não inteiro", () => {
    expect(albumSchema.safeParse({ ...base, year: "1800" }).success).toBe(false);
    expect(albumSchema.safeParse({ ...base, year: "2008.5" }).success).toBe(false);
    expect(albumSchema.safeParse({ ...base, year: "abc" }).success).toBe(false);
  });

  it("recusa título curto e visibilidade desconhecida", () => {
    expect(albumSchema.safeParse({ ...base, title: "ab" }).success).toBe(false);
    expect(albumSchema.safeParse({ ...base, visibility: "private" }).success).toBe(false);
  });
});

describe("photoSchema e hideSchema", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  it("limita a legenda a 200 caracteres", () => {
    expect(photoSchema.safeParse({ albumId: id, caption: "x".repeat(201) }).success).toBe(false);
    expect(photoSchema.parse({ albumId: id, caption: "" }).caption).toBeNull();
  });

  it("só aceita ocultar álbum ou foto", () => {
    expect(hideSchema.safeParse({ kind: "album", id, albumId: id, hidden: true, reason: "" }).success).toBe(true);
    expect(hideSchema.safeParse({ kind: "story", id, albumId: id, hidden: true, reason: "" }).success).toBe(false);
  });
});

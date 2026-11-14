import { describe, expect, it } from "vitest";

import { profileChecklist } from "@/features/painel/checklist";

const empty = { hasPhoto: false, bio: null, periodCount: 0, hasBirthday: false, hasContact: false, hasEducationOrWork: false };

describe("profileChecklist", () => {
  it("perfil vazio: nada concluído", () => {
    const result = profileChecklist(empty);
    expect(result.done).toBe(0);
    expect(result.total).toBe(6);
  });
  it("conta o que foi preenchido; bio só com espaços não vale", () => {
    const result = profileChecklist({ ...empty, hasPhoto: true, bio: "   ", periodCount: 2, hasBirthday: true });
    expect(result.done).toBe(3);
    expect(result.items.find((item) => item.id === "bio")?.done).toBe(false);
  });
  it("tudo preenchido", () => {
    expect(profileChecklist({ hasPhoto: true, bio: "Oi", periodCount: 1, hasBirthday: true, hasContact: true, hasEducationOrWork: true }).done).toBe(6);
  });
});

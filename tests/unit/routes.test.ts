import { describe, expect, it } from "vitest";

import { DEFAULT_AFTER_LOGIN, isProtectedPath, safeNextPath } from "@/lib/routes";

describe("isProtectedPath", () => {
  it("protege as áreas restritas e suas subrotas", () => {
    for (const path of ["/painel", "/admin", "/admin/caixinha", "/diretorio/abc", "/historias"]) {
      expect(isProtectedPath(path)).toBe(true);
    }
  });

  it("não protege o portal público nem rotas de nome parecido", () => {
    for (const path of ["/", "/login", "/eventos", "/caixinha", "/administracao", "/painel-publico"]) {
      expect(isProtectedPath(path)).toBe(false);
    }
  });
});

describe("safeNextPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeNextPath("/admin/caixinha?mes=11")).toBe("/admin/caixinha?mes=11");
  });

  it("recusa destinos externos e truques de redirecionamento", () => {
    const attacks = [
      "https://malicioso.example",
      "//malicioso.example",
      "/\\malicioso.example",
      "javascript:alert(1)",
      "painel",
      "/painel\nSet-Cookie: x=1",
      "",
    ];
    for (const attack of attacks) {
      expect(safeNextPath(attack)).toBe(DEFAULT_AFTER_LOGIN);
    }
    expect(safeNextPath(null)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNextPath(undefined)).toBe(DEFAULT_AFTER_LOGIN);
  });
});

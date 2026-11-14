import { describe, expect, it } from "vitest";

import { addLine, cartItemCount, cartLevel, parseCart, removeLine, setLineQuantity } from "@/features/loja/cart-lines";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("carrinho", () => {
  it("junta o mesmo produto e tamanho e limita a 20", () => {
    let lines = addLine([], { p: A, s: "M", q: 15 });
    lines = addLine(lines, { p: A, s: "M", q: 10 });
    expect(lines).toEqual([{ p: A, s: "M", q: 20 }]);
  });

  it("tamanhos diferentes viram linhas diferentes", () => {
    const lines = addLine(addLine([], { p: A, s: "M", q: 1 }), { p: A, s: "G", q: 1 });
    expect(lines).toHaveLength(2);
  });

  it("muda e remove quantidades", () => {
    const lines = [{ p: A, s: "", q: 2 }, { p: B, s: "", q: 1 }];
    expect(setLineQuantity(lines, A, "", 5)[0]?.q).toBe(5);
    expect(setLineQuantity(lines, A, "", 0)).toEqual([{ p: B, s: "", q: 1 }]);
    expect(removeLine(lines, B, "")).toEqual([{ p: A, s: "", q: 2 }]);
  });

  it("não passa de 20 linhas", () => {
    let lines: ReturnType<typeof addLine> = [];
    for (let index = 0; index < 25; index += 1) {
      lines = addLine(lines, { p: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, s: "", q: 1 });
    }
    expect(lines).toHaveLength(20);
  });

  it("ignora cookie corrompido ou adulterado", () => {
    expect(parseCart(undefined)).toEqual([]);
    expect(parseCart("não é json")).toEqual([]);
    expect(parseCart(JSON.stringify([{ p: "x", s: "", q: 1 }]))).toEqual([]);
    expect(parseCart(JSON.stringify([{ p: A, s: "", q: 999 }]))).toEqual([]);
    expect(parseCart(JSON.stringify([{ p: A, s: "M", q: 2 }]))).toEqual([{ p: A, s: "M", q: 2 }]);
  });
});

describe("indicador do carrinho", () => {
  it("soma as unidades de todas as linhas", () => {
    expect(cartItemCount([])).toBe(0);
    expect(cartItemCount([{ p: A, s: "", q: 2 }, { p: B, s: "M", q: 3 }])).toBe(5);
  });
  it("define quanto a cestinha enche", () => {
    expect([0, 1, 2, 4, 5, 20].map(cartLevel)).toEqual([0, 1, 2, 2, 3, 3]);
  });
});

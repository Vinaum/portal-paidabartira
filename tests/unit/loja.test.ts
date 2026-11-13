import { describe, expect, it } from "vitest";

import { NEXT_STATUSES, orderSchema, parseSizes, productSchema } from "@/features/loja/schemas";

describe("parseSizes", () => {
  it("separa por vírgula, apara e remove repetidos", () => {
    expect(parseSizes("P, M ,G, M")).toEqual(["P", "M", "G"]);
    expect(parseSizes("")).toEqual([]);
  });
  it("recusa excesso de tamanhos ou nomes longos", () => {
    expect(parseSizes("a,b,c,d,e,f,g,h,i,j,k,l,m")).toBeNull();
    expect(parseSizes("tamanho-muito-grande")).toBeNull();
  });
});

describe("productSchema", () => {
  const base = { productId: "", name: "Camiseta", description: "", price: "45,00", visibility: "members", sizes: "P,M", paymentInstructions: "", isPublished: true, isAvailable: true };
  it("converte preço em centavos e tamanhos em lista", () => {
    const parsed = productSchema.safeParse(base);
    expect(parsed.success && parsed.data.price).toBe(4500);
    expect(parsed.success && parsed.data.sizes).toEqual(["P", "M"]);
  });
  it("recusa preço inválido e visibilidade desconhecida", () => {
    expect(productSchema.safeParse({ ...base, price: "0" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, visibility: "todos" }).success).toBe(false);
  });
});

describe("orderSchema", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("limita a quantidade", () => {
    expect(orderSchema.safeParse({ productId: id, quantity: "2", size: "", note: "" }).success).toBe(true);
    expect(orderSchema.safeParse({ productId: id, quantity: "0", size: "", note: "" }).success).toBe(false);
    expect(orderSchema.safeParse({ productId: id, quantity: "21", size: "", note: "" }).success).toBe(false);
  });
});

describe("NEXT_STATUSES", () => {
  it("estados finais não têm saída", () => {
    expect(NEXT_STATUSES.delivered).toEqual([]);
    expect(NEXT_STATUSES.cancelled).toEqual([]);
  });
});

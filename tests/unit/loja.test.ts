import { describe, expect, it } from "vitest";

import { NEXT_STATUSES, addToCartSchema, parseSizes, pixSettingsSchema, productSchema } from "@/features/loja/schemas";

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

describe("addToCartSchema", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("limita a quantidade", () => {
    expect(addToCartSchema.safeParse({ productId: id, quantity: "2", size: "" }).success).toBe(true);
    expect(addToCartSchema.safeParse({ productId: id, quantity: "0", size: "" }).success).toBe(false);
    expect(addToCartSchema.safeParse({ productId: id, quantity: "21", size: "" }).success).toBe(false);
  });
});

describe("pixSettingsSchema", () => {
  it("em branco desliga o QR code", () => {
    expect(pixSettingsSchema.parse({ pixKey: "", receiver: "", city: "" })).toEqual({ pixKey: null, receiver: null, city: null });
  });
  it("normaliza nome e cidade para o padrão do PIX", () => {
    const parsed = pixSettingsSchema.parse({ pixKey: "Casa@Example.com", receiver: "República Paidabartira", city: "São Paulo" });
    expect(parsed).toEqual({ pixKey: "casa@example.com", receiver: "REPUBLICA PAIDABARTIRA", city: "SAO PAULO" });
  });
  it("exige recebedor, cidade e chave válida", () => {
    expect(pixSettingsSchema.safeParse({ pixKey: "casa@example.com", receiver: "", city: "Campinas" }).success).toBe(false);
    expect(pixSettingsSchema.safeParse({ pixKey: "casa@example.com", receiver: "Casa", city: "" }).success).toBe(false);
    expect(pixSettingsSchema.safeParse({ pixKey: "não é chave", receiver: "Casa", city: "Campinas" }).success).toBe(false);
  });
});

describe("NEXT_STATUSES", () => {
  it("pedido solicitado pode ir direto para pago", () => {
    expect(NEXT_STATUSES.requested).toContain("paid");
  });
  it("estados finais não têm saída", () => {
    expect(NEXT_STATUSES.delivered).toEqual([]);
    expect(NEXT_STATUSES.cancelled).toEqual([]);
  });
});

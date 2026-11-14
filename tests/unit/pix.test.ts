import { describe, expect, it } from "vitest";

import { buildPixPayload, crc16, normalizePixKey, normalizePixText, orderCode } from "@/features/loja/pix";

/** Lê um texto TLV (id de 2 dígitos, tamanho de 2 dígitos, valor). */
function parseTlv(input: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let position = 0;
  while (position < input.length) {
    const id = input.slice(position, position + 2);
    const length = Number(input.slice(position + 2, position + 4));
    fields[id] = input.slice(position + 4, position + 4 + length);
    position += 4 + length;
  }
  return fields;
}

describe("crc16", () => {
  it("bate com o vetor padrão CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
});

describe("buildPixPayload", () => {
  const payload = buildPixPayload({
    key: "casa@example.com",
    receiver: "República Paidabartira",
    city: "Campinas",
    amountCents: 15050,
    txid: "PDBABCD1234",
  });

  it("monta os campos obrigatórios do BR Code", () => {
    const fields = parseTlv(payload);
    expect(fields["00"]).toBe("01");
    expect(fields["52"]).toBe("0000");
    expect(fields["53"]).toBe("986");
    expect(fields["54"]).toBe("150.50");
    expect(fields["58"]).toBe("BR");
    expect(fields["59"]).toBe("REPUBLICA PAIDABARTIRA");
    expect(fields["60"]).toBe("CAMPINAS");
    expect(parseTlv(fields["26"] ?? "")).toEqual({ "00": "br.gov.bcb.pix", "01": "casa@example.com" });
    expect(parseTlv(fields["62"] ?? "")["05"]).toBe("PDBABCD1234");
  });

  it("termina com o CRC correto do restante", () => {
    expect(payload.slice(-8, -4)).toBe("6304");
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)));
  });

  it("formata centavos com duas casas e recusa valor inválido", () => {
    expect(parseTlv(buildPixPayload({ key: "a@b.co", receiver: "X", city: "Y", amountCents: 5, txid: "A" }))["54"]).toBe("0.05");
    expect(() => buildPixPayload({ key: "a@b.co", receiver: "X", city: "Y", amountCents: 0, txid: "A" })).toThrow();
    expect(() => buildPixPayload({ key: "a@b.co", receiver: "X", city: "Y", amountCents: 1.5, txid: "A" })).toThrow();
  });
});

describe("normalizePixText e normalizePixKey", () => {
  it("tira acento, símbolos e limita o tamanho", () => {
    expect(normalizePixText("São João & Cia.", 25)).toBe("SAO JOAO CIA");
    expect(normalizePixText("abcdefghij", 5)).toBe("ABCDE");
  });
  it("aceita e limpa os tipos de chave", () => {
    expect(normalizePixKey("Casa@Example.com")).toBe("casa@example.com");
    expect(normalizePixKey("123.456.789-09")).toBe("12345678909");
    expect(normalizePixKey("12.345.678/0001-95")).toBe("12345678000195");
    expect(normalizePixKey("+55 (19) 99999-8888")).toBe("+5519999998888");
    expect(normalizePixKey("123e4567-e89b-12d3-a456-426614174000")).toBe("123e4567-e89b-12d3-a456-426614174000");
  });
  it("recusa o que não é chave", () => {
    expect(normalizePixKey("")).toBeNull();
    expect(normalizePixKey("19999998888 ab")).toBeNull();
    expect(normalizePixKey("+1 555 0100")).toBeNull();
    expect(normalizePixKey("12345")).toBeNull();
  });
});

describe("orderCode", () => {
  it("usa os 8 primeiros caracteres do id", () => {
    expect(orderCode("abcdef12-3456-4789-8abc-def012345678")).toBe("PDBABCDEF12");
  });
});

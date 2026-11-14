import { z } from "zod";

/**
 * O carrinho mora num cookie do próprio navegador (sem tabela no banco): é só uma lista de
 * "produto, tamanho, quantidade". Preços e disponibilidade nunca vêm do cookie; são lidos do
 * banco na hora de mostrar o carrinho e de finalizar.
 */
export const MAX_CART_LINES = 20;

export const cartLineSchema = z.object({
  p: z.uuid(),
  s: z.string().max(12),
  q: z.number().int().min(1).max(20),
});
export type CartLine = z.infer<typeof cartLineSchema>;

const cartSchema = z.array(cartLineSchema).max(MAX_CART_LINES);

/** Junta linhas do mesmo produto e tamanho (quantidade limitada a 20). */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const index = lines.findIndex((item) => item.p === line.p && item.s === line.s);
  if (index === -1) return [...lines, line].slice(0, MAX_CART_LINES);
  return lines.map((item, position) => (position === index ? { ...item, q: Math.min(20, item.q + line.q) } : item));
}

export function setLineQuantity(lines: CartLine[], p: string, s: string, q: number): CartLine[] {
  if (q < 1) return removeLine(lines, p, s);
  return lines.map((item) => (item.p === p && item.s === s ? { ...item, q: Math.min(20, q) } : item));
}

export function removeLine(lines: CartLine[], p: string, s: string): CartLine[] {
  return lines.filter((item) => !(item.p === p && item.s === s));
}

export function parseCart(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  try {
    const parsed = cartSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}


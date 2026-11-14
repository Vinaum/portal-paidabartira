import { z } from "zod";

import { parseBRL } from "@/features/caixinha/money";

import { normalizePixKey, normalizePixText } from "./pix";

export const PRODUCT_VISIBILITIES = ["public", "members"] as const;
export const PRODUCT_VISIBILITY_LABELS = {
  public: "Público: qualquer visitante vê o produto e o preço",
  members: "Só integrantes (quem mora, já morou ou é agregado)",
} as const satisfies Record<(typeof PRODUCT_VISIBILITIES)[number], string>;

export const ORDER_STATUSES = ["requested", "confirmed", "paid", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  requested: "Solicitado",
  confirmed: "Confirmado",
  paid: "Pago",
  delivered: "Entregue",
  cancelled: "Cancelado",
};
/** Próximos status permitidos (espelha a regra do banco). */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  requested: ["confirmed", "paid", "cancelled"],
  confirmed: ["paid", "cancelled"],
  paid: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

/** "P, M, G" -> ["P","M","G"], sem repetições. */
export function parseSizes(input: string): string[] | null {
  const parts = input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const unique = [...new Set(parts)];
  if (unique.length > 12 || unique.some((size) => size.length > 12)) return null;
  return unique;
}

export const productSchema = z.object({
  productId: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.uuid().nullable()),
  name: z.string().trim().min(3, "O nome precisa de ao menos 3 letras.").max(80, "Use até 80 caracteres."),
  description: optionalText(1500, "Use até 1500 caracteres."),
  price: z
    .string()
    .trim()
    .min(1, "Informe o preço.")
    .transform((value, ctx) => {
      const cents = parseBRL(value);
      if (cents === null || cents > 100_000_000) {
        ctx.addIssue({ code: "custom", message: "Preço inválido. Exemplo: 45,00" });
        return 0;
      }
      return cents;
    }),
  visibility: z.enum(PRODUCT_VISIBILITIES, { error: "Escolha quem pode ver." }),
  sizes: z.string().transform((value, ctx) => {
    const sizes = parseSizes(value);
    if (!sizes) ctx.addIssue({ code: "custom", message: "No máximo 12 tamanhos, de até 12 letras cada." });
    return sizes ?? [];
  }),
  paymentInstructions: optionalText(500, "Use até 500 caracteres."),
  isPublished: z.boolean(),
  isAvailable: z.boolean(),
});

/** Adicionar ao carrinho. */
export const addToCartSchema = z.object({
  productId: z.uuid(),
  quantity: z.coerce.number().int("Use um número inteiro.").min(1, "Mínimo 1.").max(20, "Máximo 20."),
  size: z.string().trim().max(12),
});

export const cartLineFormSchema = z.object({
  productId: z.uuid(),
  size: z.string().trim().max(12),
  quantity: z.coerce.number().int("Use um número inteiro.").min(0, "Mínimo 0.").max(20, "Máximo 20."),
});

export const checkoutSchema = z.object({ note: optionalText(300, "Use até 300 caracteres.") });

/** Chave PIX da loja. Em branco desliga o QR code. */
export const pixSettingsSchema = z
  .object({
    pixKey: z.string().trim().max(120),
    receiver: z.string().trim().max(60),
    city: z.string().trim().max(40),
  })
  .transform((value, ctx) => {
    if (value.pixKey === "") return { pixKey: null, receiver: null, city: null };
    const key = normalizePixKey(value.pixKey);
    if (!key) {
      ctx.addIssue({
        code: "custom",
        path: ["pixKey"],
        message: "Chave inválida. Use e-mail, celular com +55, CPF, CNPJ ou chave aleatória.",
      });
      return z.NEVER;
    }
    const receiver = normalizePixText(value.receiver, 25);
    const city = normalizePixText(value.city, 15);
    if (!receiver) ctx.addIssue({ code: "custom", path: ["receiver"], message: "Informe o nome do recebedor." });
    if (!city) ctx.addIssue({ code: "custom", path: ["city"], message: "Informe a cidade." });
    return { pixKey: key, receiver, city };
  });

export const statusSchema = z.object({
  orderId: z.uuid(),
  status: z.enum(ORDER_STATUSES),
  note: optionalText(200, "Use até 200 caracteres."),
});

export const orderIdSchema = z.object({ orderId: z.uuid() });

export const managerSchema = z.object({
  memberId: z.uuid({ error: "Escolha o integrante." }),
  active: z.boolean(),
});

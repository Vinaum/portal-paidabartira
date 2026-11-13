import { z } from "zod";

import { parseBRL } from "./money";

export const FUND_VISIBILITIES = ["public", "members"] as const;
export const VISIBILITY_LABELS = {
  public: "Pública: qualquer visitante vê o total arrecadado",
  members: "Só integrantes",
} as const satisfies Record<(typeof FUND_VISIBILITIES)[number], string>;

export const EXPENSE_CATEGORIES = [
  "Contas",
  "Manutenção",
  "Compras",
  "Eventos",
  "Documentação",
  "Obra",
  "Outros",
] as const;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

const money = (required: string) =>
  z
    .string()
    .trim()
    .min(1, required)
    .transform((value, ctx) => {
      const cents = parseBRL(value);
      if (cents === null) ctx.addIssue({ code: "custom", message: "Valor inválido. Exemplo: 150,00" });
      return cents ?? 0;
    });

export const fundSchema = z.object({
  fundId: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.uuid().nullable()),
  name: z.string().trim().min(3, "O nome precisa de ao menos 3 letras.").max(80, "Use até 80 caracteres."),
  description: optionalText(1000, "Use até 1000 caracteres."),
  goal: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const cents = parseBRL(value);
      if (cents === null) ctx.addIssue({ code: "custom", message: "Valor inválido. Exemplo: 50000,00" });
      return cents;
    }),
  visibility: z.enum(FUND_VISIBILITIES, { error: "Escolha quem pode ver." }),
  pixKey: optionalText(140, "Use até 140 caracteres."),
  pixHolder: optionalText(80, "Use até 80 caracteres."),
  pixInstructions: optionalText(500, "Use até 500 caracteres."),
  isActive: z.boolean(),
});

/** "YYYY-MM-DD" válido e não futuro (comparado ao dia de hoje em Brasília). */
export function isValidPastOrToday(date: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  return date <= today;
}

export function entrySchema(today: string) {
  return z
    .object({
      fundId: z.uuid(),
      kind: z.enum(["income", "expense"], { error: "Escolha entrada ou saída." }),
      amount: money("Informe o valor."),
      occurredOn: z.string().refine((value) => isValidPastOrToday(value, today), "Data inválida ou futura."),
      category: z.string().trim().max(40),
      description: z.string().trim().min(3, "Descreva em ao menos 3 letras.").max(200, "Use até 200 caracteres."),
    })
    .superRefine((value, ctx) => {
      if (value.kind === "expense" && !(EXPENSE_CATEGORIES as readonly string[]).includes(value.category)) {
        ctx.addIssue({ code: "custom", path: ["category"], message: "Escolha a categoria da saída." });
      }
    })
    .transform((value) => ({ ...value, category: value.kind === "expense" ? value.category : null }));
}

export const reverseSchema = z.object({
  entryId: z.uuid(),
  fundId: z.uuid(),
  reason: z.string().trim().min(3, "Explique o motivo em ao menos 3 letras.").max(160, "Use até 160 caracteres."),
});

export const managerSchema = z.object({
  fundId: z.uuid(),
  memberId: z.uuid({ error: "Escolha o integrante." }),
  active: z.boolean(),
});

import { z } from "zod";

import { parseBRL } from "@/features/caixinha/money";
import { normalizePixKey } from "@/features/loja/pix";

export const ASSOCIATION_STATUSES = ["pending", "active", "declined", "left"] as const;
export type AssociationStatus = (typeof ASSOCIATION_STATUSES)[number];
export const STATUS_LABELS: Record<AssociationStatus, string> = {
  pending: "Aguardando aprovação",
  active: "Associado",
  declined: "Recusado",
  left: "Desligado",
};

export const DUE_STATUSES = ["informed", "confirmed", "rejected"] as const;
export type DueStatus = (typeof DUE_STATUSES)[number];
export const DUE_LABELS: Record<DueStatus, string> = {
  informed: "Aguardando conferência",
  confirmed: "Confirmada",
  rejected: "Não identificada",
};

export const DOC_KINDS = ["estatuto", "ata", "prestacao_contas", "outro"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_KIND_LABELS: Record<DocKind, string> = {
  estatuto: "Estatuto",
  ata: "Ata",
  prestacao_contas: "Prestação de contas",
  outro: "Outro",
};

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const EXPENSE_CATEGORIES = ["Contas", "Manutenção", "Compras", "Eventos", "Documentação", "Obra", "Outros"] as const;

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
      if (cents === null) ctx.addIssue({ code: "custom", message: "Valor inválido. Exemplo: 50,00" });
      return cents ?? 0;
    });

export const memberIdSchema = z.object({ memberId: z.uuid() });
export const decideMemberSchema = z.object({ memberId: z.uuid(), status: z.enum(["active", "declined", "left"]) });
export const dueIdSchema = z.object({ dueId: z.uuid(), confirm: z.enum(["yes", "no"]) });

/** Mês no formato "AAAA-MM" (campo type=month); vira o primeiro dia do mês. */
export const dueSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Escolha o mês.")
    .transform((value) => `${value}-01`),
  amount: money("Informe o valor pago."),
});

export const entrySchema = z
  .object({
    kind: z.enum(["income", "expense"], { error: "Escolha entrada ou saída." }),
    amount: money("Informe o valor."),
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
    category: optionalText(40, "Use até 40 caracteres."),
    description: z.string().trim().min(3, "Descreva em ao menos 3 letras.").max(200, "Use até 200 caracteres."),
  })
  .refine((value) => value.kind === "income" || value.category !== null, {
    path: ["category"],
    message: "Escolha uma categoria para a saída.",
  });

export const reverseSchema = z.object({
  entryId: z.uuid(),
  reason: z.string().trim().min(3, "Informe o motivo.").max(160, "Use até 160 caracteres."),
});

export const settingsSchema = z.object({
  pixKey: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const key = normalizePixKey(value);
      if (key === null) ctx.addIssue({ code: "custom", message: "Chave PIX não reconhecida (e-mail, celular com +55, CPF, CNPJ ou chave aleatória)." });
      return key;
    }),
  pixHolder: optionalText(80, "Use até 80 caracteres."),
  pixInstructions: optionalText(500, "Use até 500 caracteres."),
  monthly: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const cents = parseBRL(value);
      if (cents === null || cents > 100_000_000) ctx.addIssue({ code: "custom", message: "Valor inválido. Exemplo: 50,00" });
      return cents;
    }),
});

export const documentSchema = z.object({
  kind: z.enum(DOC_KINDS, { error: "Escolha o tipo." }),
  title: z.string().trim().min(3, "O título precisa de ao menos 3 letras.").max(120, "Use até 120 caracteres."),
  description: optionalText(500, "Use até 500 caracteres."),
  docDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do documento."),
});

export const removeDocumentSchema = z.object({ documentId: z.uuid() });

/** O arquivo enviado precisa ser PDF de verdade (assinatura "%PDF") e caber no limite. */
export function checkPdf(bytes: Uint8Array): string | null {
  if (bytes.byteLength === 0) return "Escolha um arquivo PDF.";
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) return "O PDF passa de 8 MB.";
  const head = String.fromCharCode(...bytes.slice(0, 5));
  return head === "%PDF-" ? null : "O arquivo não é um PDF válido.";
}

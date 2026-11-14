import { z } from "zod";

import { MEMBER_CATEGORIES, MEMBER_ROLES } from "@/lib/permissions";

/** Versão vigente da política de privacidade (tabela privacy_policy_versions). */
export const POLICY_VERSION = "2026-11-14.2";

export const REQUEST_STATUSES = [
  "pending",
  "needs_info",
  "approved",
  "invited",
  "activated",
  "rejected",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: "Pendente",
  needs_info: "Aguardando informações",
  approved: "Aprovada",
  invited: "Convidada",
  activated: "Ativada",
  rejected: "Rejeitada",
};

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

/** Limites iguais aos CHECKs da tabela membership_requests. */
export const accessRequestSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome completo.").max(120, "Nome muito longo."),
  nickname: optionalText(60, "Apelido muito longo."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "E-mail muito longo.")
    .pipe(z.email("Informe um e-mail válido.")),
  phone: optionalText(30, "Telefone muito longo."),
  relationship: z
    .string()
    .trim()
    .min(2, "Conte qual é a sua relação com a república.")
    .max(200, "Use até 200 caracteres."),
  justification: z
    .string()
    .trim()
    .min(10, "Conte um pouco mais (ao menos 10 caracteres).")
    .max(2000, "Use até 2000 caracteres."),
  extraInfo: optionalText(2000, "Use até 2000 caracteres."),
  consent: z.literal("on", { error: "É preciso aceitar a política de privacidade." }),
});

const adminNotes = optionalText(4000, "Use até 4000 caracteres.");
const requestId = z.uuid();

export const reviewRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    requestId,
    category: z.enum(MEMBER_CATEGORIES, { error: "Escolha a categoria." }),
    isFounder: z.boolean(),
    role: z.enum(MEMBER_ROLES),
    adminNotes,
  }),
  z.object({ action: z.literal("reject"), requestId, adminNotes }),
  z.object({
    action: z.literal("request_info"),
    requestId,
    infoRequest: z.string().trim().min(5, "Descreva a informação necessária.").max(2000),
    adminNotes,
  }),
  z.object({ action: z.literal("reopen"), requestId, adminNotes }),
]);

export const invitationSchema = z.object({
  requestId,
  mode: z.enum(["email", "link"]),
});

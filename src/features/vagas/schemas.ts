import { z } from "zod";

import { parseBRL } from "@/features/caixinha/money";

export const VACANCY_STATUSES = ["open", "closed"] as const;
export type VacancyStatus = (typeof VACANCY_STATUSES)[number];
export const VACANCY_STATUS_LABELS: Record<VacancyStatus, string> = { open: "Aberta", closed: "Encerrada" };

export const INTEREST_STATUSES = ["new", "contacted", "closed"] as const;
export type InterestStatus = (typeof INTEREST_STATUSES)[number];
export const INTEREST_STATUS_LABELS: Record<InterestStatus, string> = {
  new: "Novo",
  contacted: "Contatado",
  closed: "Encerrado",
};

/** Candidatos ficam no máximo este número de dias (a regra é do banco). */
export const INTEREST_RETENTION_DAYS = 90;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

export const vacancySchema = z.object({
  vacancyId: z.uuid().nullable(),
  title: z.string().trim().min(3, "O título precisa de ao menos 3 letras.").max(100, "Use até 100 caracteres."),
  description: z.string().trim().min(10, "Descreva a vaga (ao menos 10 caracteres).").max(2000, "Use até 2000 caracteres."),
  monthly: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const cents = parseBRL(value);
      if (cents === null || cents > 100_000_000) ctx.addIssue({ code: "custom", message: "Valor inválido. Exemplo: 850,00" });
      return cents;
    }),
  availableFrom: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Data inválida.")
    .transform((value) => (value === "" ? null : value)),
});

export const vacancyStatusSchema = z.object({ vacancyId: z.uuid(), status: z.enum(VACANCY_STATUSES) });
export const vacancyIdSchema = z.object({ vacancyId: z.uuid() });
export const interestStatusSchema = z.object({ interestId: z.uuid(), status: z.enum(INTEREST_STATUSES) });
export const interestIdSchema = z.object({ interestId: z.uuid() });

/** Limites iguais aos CHECKs de vacancy_interests. */
export const interestSchema = z.object({
  vacancyId: z.uuid(),
  name: z.string().trim().min(3, "Informe seu nome completo.").max(120, "Nome muito longo."),
  email: z.string().trim().toLowerCase().max(254, "E-mail muito longo.").pipe(z.email("Informe um e-mail válido.")),
  phone: optionalText(30, "Telefone muito longo."),
  course: optionalText(100, "Use até 100 caracteres."),
  message: optionalText(1000, "Use até 1000 caracteres."),
  consent: z.literal("on", { error: "É preciso aceitar a política de privacidade." }),
});

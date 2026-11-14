import { z } from "zod";

import { isValidPastOrToday } from "@/features/caixinha/schemas";

export const VISIBILITIES = ["public", "members"] as const;
export const VISIBILITY_LABELS = {
  public: "Público: qualquer visitante lê",
  members: "Só integrantes",
} as const satisfies Record<(typeof VISIBILITIES)[number], string>;

/** "YYYY-MM-DD" válido (qualquer dia, inclusive futuro). */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const announcementSchema = z.object({
  announcementId: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.uuid().nullable()),
  title: z.string().trim().min(3, "O título precisa de ao menos 3 letras.").max(120, "Use até 120 caracteres."),
  body: z.string().trim().min(3, "Escreva o comunicado.").max(4000, "Use até 4000 caracteres."),
  visibility: z.enum(VISIBILITIES, { error: "Escolha quem pode ler." }),
  isPinned: z.boolean(),
  expiresOn: z
    .string()
    .trim()
    .refine((value) => value === "" || isIsoDate(value), "Data inválida.")
    .transform((value) => (value === "" ? null : value)),
});

export const deleteSchema = z.object({ announcementId: z.uuid() });

export { isValidPastOrToday };

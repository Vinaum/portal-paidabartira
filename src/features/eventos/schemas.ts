import { z } from "zod";

import { fromLocalInput } from "./time";

export const EVENT_STATUSES = ["draft", "published", "cancelled"] as const;
export const EVENT_VISIBILITIES = ["public", "members"] as const;
export const RSVP_ANSWERS = ["going", "maybe", "not_going"] as const;

export const STATUS_LABELS = {
  draft: "Rascunho",
  published: "Publicado",
  cancelled: "Cancelado",
} as const satisfies Record<(typeof EVENT_STATUSES)[number], string>;

export const VISIBILITY_LABELS = {
  public: "Público (qualquer visitante)",
  members: "Só integrantes",
} as const satisfies Record<(typeof EVENT_VISIBILITIES)[number], string>;

export const RSVP_LABELS = {
  going: "Vou",
  maybe: "Talvez",
  not_going: "Não vou",
} as const satisfies Record<(typeof RSVP_ANSWERS)[number], string>;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

const instant = (required: string) =>
  z
    .string()
    .trim()
    .min(1, required)
    .transform((value, ctx) => {
      const iso = fromLocalInput(value);
      if (!iso) ctx.addIssue({ code: "custom", message: "Data ou horário inválido." });
      return iso ?? "";
    });

/** Limites iguais aos CHECKs da tabela events. */
export const eventSchema = z
  .object({
    eventId: z
      .string()
      .transform((value) => (value === "" ? null : value))
      .pipe(z.uuid().nullable()),
    title: z.string().trim().min(3, "O título precisa de ao menos 3 letras.").max(120, "Use até 120 caracteres."),
    description: optionalText(4000, "Use até 4000 caracteres."),
    location: optionalText(200, "Use até 200 caracteres."),
    startsAt: instant("Informe quando começa."),
    endsAt: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (value === "") return null;
        const iso = fromLocalInput(value);
        if (!iso) ctx.addIssue({ code: "custom", message: "Data ou horário inválido." });
        return iso;
      }),
    visibility: z.enum(EVENT_VISIBILITIES, { error: "Escolha quem pode ver." }),
    status: z.enum(EVENT_STATUSES, { error: "Escolha a situação." }),
  })
  .refine((value) => value.endsAt === null || value.endsAt >= value.startsAt, {
    path: ["endsAt"],
    error: "O fim não pode ser antes do início.",
  });

export const rsvpSchema = z.object({
  eventId: z.uuid(),
  answer: z.enum(RSVP_ANSWERS, { error: "Escolha uma resposta." }),
  guests: z
    .string()
    .trim()
    .transform((value) => (value === "" ? 0 : Number(value)))
    .pipe(z.number().int("Use um número inteiro.").min(0, "Use 0 ou mais.").max(10, "No máximo 10 acompanhantes.")),
});

export const eventIdSchema = z.object({ eventId: z.uuid() });

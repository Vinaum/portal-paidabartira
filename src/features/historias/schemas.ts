import { z } from "zod";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

export const storySchema = z.object({
  storyId: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.uuid().nullable()),
  title: z.string().trim().min(3, "O título precisa de ao menos 3 letras.").max(120, "Use até 120 caracteres."),
  body: z.string().trim().min(10, "Conte um pouco mais (ao menos 10 letras).").max(8000, "Use até 8000 caracteres."),
  era: optionalText(40, "Use até 40 caracteres."),
});

export const commentSchema = z.object({
  storyId: z.uuid(),
  body: z.string().trim().min(1, "Escreva o comentário.").max(500, "Use até 500 caracteres."),
});

export const idSchema = z.object({ id: z.uuid() });

export const hideSchema = z.object({
  storyId: z.uuid(),
  hidden: z.boolean(),
  reason: optionalText(200, "Use até 200 caracteres."),
});

export const photoIdSchema = z.object({ storyId: z.uuid(), photoId: z.uuid() });

import { z } from "zod";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value === "" ? null : value));

export const albumSchema = z.object({
  albumId: z
    .string()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.uuid().nullable()),
  title: z.string().trim().min(3, "O título precisa de ao menos 3 letras.").max(120, "Use até 120 caracteres."),
  description: optionalText(1000, "Use até 1000 caracteres."),
  year: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .pipe(z.number().int("Use um ano com 4 dígitos.").min(1950, "Use um ano a partir de 1950.").max(2100, "Ano inválido.").nullable()),
  visibility: z.enum(["public", "members"], { error: "Escolha quem pode ver." }),
});

export const idSchema = z.object({ id: z.uuid() });

export const photoSchema = z.object({
  albumId: z.uuid(),
  caption: optionalText(200, "Use até 200 caracteres."),
});

export const removePhotoSchema = z.object({ albumId: z.uuid(), photoId: z.uuid() });

export const hideSchema = z.object({
  kind: z.enum(["album", "photo"]),
  id: z.uuid(),
  albumId: z.uuid(),
  hidden: z.boolean(),
  reason: optionalText(200, "Use até 200 caracteres."),
});

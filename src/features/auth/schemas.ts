import { z } from "zod";

/** Regras compartilhadas entre formulário (cliente) e Server Action. */
export const PASSWORD_MIN_LENGTH = 10;

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "E-mail muito longo.")
  .pipe(z.email("Informe um e-mail válido."));

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha.").max(200),
  next: z.string().max(500).optional(),
});

export const passwordResetRequestSchema = z.object({ email });

export const setPasswordSchema = z
  .object({
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `A senha precisa ter ao menos ${PASSWORD_MIN_LENGTH} caracteres.`,
      )
      .max(200, "Senha muito longa.")
      .refine((value) => /[A-Za-zÀ-ÿ]/.test(value) && /\d/.test(value), {
        message: "Use letras e números.",
      }),
    confirmation: z.string(),
  })
  .refine((data) => data.password === data.confirmation, {
    path: ["confirmation"],
    message: "As senhas não conferem.",
  });

export const confirmLinkSchema = z.object({
  token_hash: z.string().min(10).max(300),
  type: z.enum(["invite", "recovery", "email_change", "email"]),
});

export { fieldErrorsFrom, initialFormState, type FormState } from "@/lib/form";

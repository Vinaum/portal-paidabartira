import type { z } from "zod";

/** Estado devolvido pelas Server Actions aos formulários (useActionState). */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Valores enviados, devolvidos em caso de erro para não apagar o que a pessoa digitou. */
  values?: Record<string, string>;
  /** Dados extras para a tela (ex.: link de convite gerado). */
  data?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

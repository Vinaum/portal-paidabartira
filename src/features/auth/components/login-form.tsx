"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";

import { signIn } from "../actions";
import { initialFormState } from "../schemas";
import { SubmitButton } from "./submit-button";

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialFormState);
  const next = useSearchParams().get("next") ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <input type="hidden" name="next" value={next} />
      <TextField
        name="email"
        label="E-mail"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />
      <TextField
        name="password"
        label="Senha"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
    </form>
  );
}

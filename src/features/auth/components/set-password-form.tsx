"use client";

import { useActionState } from "react";

import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";

import { setPassword } from "../actions";
import { PASSWORD_MIN_LENGTH, initialFormState } from "../schemas";
import { SubmitButton } from "./submit-button";

export function SetPasswordForm() {
  const [state, formAction] = useActionState(setPassword, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <TextField
        name="password"
        label="Nova senha"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`Ao menos ${PASSWORD_MIN_LENGTH} caracteres, com letras e números.`}
        error={state.fieldErrors?.password}
      />
      <TextField
        name="confirmation"
        label="Repita a senha"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirmation}
      />
      <SubmitButton pendingLabel="Salvando…">Salvar senha</SubmitButton>
    </form>
  );
}

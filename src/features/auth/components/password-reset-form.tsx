"use client";

import { useActionState } from "react";

import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";

import { requestPasswordReset } from "../actions";
import { initialFormState } from "../schemas";
import { SubmitButton } from "./submit-button";

export function PasswordResetForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialFormState);

  if (state.status === "success") {
    return <Notice tone="success">{state.message}</Notice>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <TextField
        name="email"
        label="E-mail de login"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />
      <SubmitButton>Enviar link</SubmitButton>
    </form>
  );
}

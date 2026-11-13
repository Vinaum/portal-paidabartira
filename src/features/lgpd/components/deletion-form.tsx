"use client";

import { useActionState } from "react";

import { CheckboxField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { requestDeletion } from "../actions";

export function DeletionForm() {
  const [state, formAction] = useActionState(requestDeletion, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <TextareaField
        name="details"
        label="Quer contar o motivo? (opcional)"
        defaultValue={state.values?.details ?? ""}
        error={state.fieldErrors?.details}
      />
      <div>
        <CheckboxField name="confirm">
          Entendo que o pedido é analisado pela administração e que, se aceito, meu perfil e meus dados pessoais são
          apagados.
        </CheckboxField>
        {state.fieldErrors?.confirm ? (
          <p className="mt-1 text-sm font-semibold text-vinho">{state.fieldErrors.confirm}</p>
        ) : null}
      </div>
      <div>
        <SubmitButton variant="dark" pendingLabel="Enviando…">
          Pedir exclusão da conta
        </SubmitButton>
      </div>
    </form>
  );
}

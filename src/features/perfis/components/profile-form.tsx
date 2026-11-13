"use client";

import { useActionState } from "react";

import { CheckboxField, SelectField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState, type FormState } from "@/lib/form";

import { VISIBILITIES, VISIBILITY_LABELS, type Visibility } from "../schemas";

export type FieldDef = {
  name: string;
  label: string;
  kind?: "text" | "textarea" | "email" | "tel" | "url" | "date" | "number";
  hint?: string;
  autoComplete?: string;
  required?: boolean;
  /** Ocupa a linha inteira em telas largas. */
  wide?: boolean;
};

type Action = (previous: FormState, formData: FormData) => Promise<FormState>;

/**
 * Formulário genérico das seções do perfil: campos de texto, um seletor
 * opcional de visibilidade e uma caixa de seleção opcional.
 */
export function ProfileForm({
  action,
  fields,
  initial,
  visibility,
  checkbox,
  submitLabel = "Salvar",
}: {
  action: Action;
  fields: FieldDef[];
  initial: Record<string, string>;
  visibility?: Visibility;
  checkbox?: { name: string; label: string; checked: boolean; hint?: string };
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? initial;

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.message ? (
        <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>
      ) : null}
      {state.status === "error" && !state.message ? <Notice tone="error">Confira os campos destacados.</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) =>
          field.kind === "textarea" ? (
            <TextareaField
              key={field.name}
              name={field.name}
              label={field.label}
              hint={field.hint}
              required={field.required}
              defaultValue={values[field.name] ?? ""}
              error={errors[field.name]}
              className="sm:col-span-2"
            />
          ) : (
            <TextField
              key={field.name}
              name={field.name}
              label={field.label}
              type={field.kind ?? "text"}
              hint={field.hint}
              autoComplete={field.autoComplete}
              required={field.required}
              defaultValue={values[field.name] ?? ""}
              error={errors[field.name]}
              className={field.wide ? "sm:col-span-2" : undefined}
            />
          ),
        )}
      </div>

      {checkbox ? (
        <div>
          <CheckboxField name={checkbox.name} defaultChecked={checkbox.checked}>
            {checkbox.label}
          </CheckboxField>
          {checkbox.hint ? <p className="mt-1 text-sm text-sepia-escuro">{checkbox.hint}</p> : null}
        </div>
      ) : null}

      {visibility ? (
        <SelectField
          name="visibility"
          label="Quem pode ver"
          defaultValue={(values.visibility as Visibility | undefined) ?? visibility}
          error={errors.visibility}
          className="max-w-xs"
        >
          {VISIBILITIES.map((option) => (
            <option key={option} value={option}>
              {VISIBILITY_LABELS[option]}
            </option>
          ))}
        </SelectField>
      ) : null}

      <div>
        <SubmitButton pendingLabel="Salvando…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

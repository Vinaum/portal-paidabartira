"use client";

import { useActionState } from "react";

import { SelectField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { addEntry, reverseEntry } from "../actions";
import { EXPENSE_CATEGORIES } from "../schemas";

export function AddEntryForm({ fundId, today }: { fundId: string; today: string }) {
  const [state, formAction] = useActionState(addEntry, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <input type="hidden" name="fundId" value={fundId} />
      <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
        <legend className="mb-1 font-semibold">Tipo</legend>
        {[
          ["income", "Entrada"],
          ["expense", "Saída"],
        ].map(([value, label]) => (
          <label key={value} className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="kind"
              value={value}
              defaultChecked={(values.kind ?? "income") === value}
              className="h-5 w-5 accent-verde"
              required
            />
            {label}
          </label>
        ))}
        {errors.kind ? <p className="w-full text-sm font-semibold text-vinho">{errors.kind}</p> : null}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="amount"
          label="Valor (R$)"
          inputMode="decimal"
          required
          defaultValue={values.amount ?? ""}
          hint="Exemplo: 150,00"
          error={errors.amount}
        />
        <TextField
          name="occurredOn"
          type="date"
          label="Data"
          required
          max={today}
          defaultValue={values.occurredOn ?? today}
          error={errors.occurredOn}
        />
      </div>
      <SelectField
        name="category"
        label="Categoria (obrigatória para saída)"
        defaultValue={values.category ?? ""}
        error={errors.category}
      >
        <option value="">—</option>
        {EXPENSE_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </SelectField>
      <TextareaField
        name="description"
        label="Descrição"
        rows={2}
        required
        defaultValue={values.description ?? ""}
        hint="Saídas aparecem, com esta descrição, para todos os integrantes. Entradas aparecem só somadas por mês: não escreva o nome de quem contribuiu."
        error={errors.description}
      />
      <div>
        <SubmitButton pendingLabel="Registrando…">Registrar lançamento</SubmitButton>
      </div>
    </form>
  );
}

/** Estorno: abre um campo de motivo. O lançamento original nunca é alterado. */
export function ReverseEntryForm({ entryId, fundId }: { entryId: string; fundId: string }) {
  const [state, formAction] = useActionState(reverseEntry, initialFormState);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold underline-offset-4 hover:underline">Estornar</summary>
      <form action={formAction} className="mt-2 flex flex-col gap-2">
        {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
        <input type="hidden" name="entryId" value={entryId} />
        <input type="hidden" name="fundId" value={fundId} />
        <TextField name="reason" label="Motivo do estorno" maxLength={160} required error={state.fieldErrors?.reason} />
        <div>
          <SubmitButton variant="outline" pendingLabel="Estornando…">
            Confirmar estorno
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}

"use client";

import { useActionState } from "react";

import { CheckboxField, SelectField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { saveFund } from "../actions";
import { FUND_VISIBILITIES, VISIBILITY_LABELS } from "../schemas";

export type FundFormValues = {
  id: string;
  name: string;
  description: string;
  goal: string;
  visibility: (typeof FUND_VISIBILITIES)[number];
  pixKey: string;
  pixHolder: string;
  pixInstructions: string;
  isActive: boolean;
};

const EMPTY: FundFormValues = {
  id: "",
  name: "",
  description: "",
  goal: "",
  visibility: "members",
  pixKey: "",
  pixHolder: "",
  pixInstructions: "",
  isActive: true,
};

export function FundForm({ fund = EMPTY }: { fund?: FundFormValues }) {
  const [state, formAction] = useActionState(saveFund, initialFormState);
  const errors = state.fieldErrors ?? {};
  const v = (key: Exclude<keyof FundFormValues, "isActive">) => state.values?.[key] ?? fund[key];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <input type="hidden" name="fundId" value={fund.id} />
      <TextField name="name" label="Nome da caixinha" required maxLength={80} defaultValue={v("name")} error={errors.name} />
      <TextareaField
        name="description"
        label="Para que serve (opcional)"
        rows={3}
        defaultValue={v("description")}
        error={errors.description}
      />
      <TextField
        name="goal"
        label="Meta em reais (opcional)"
        inputMode="decimal"
        defaultValue={v("goal")}
        hint="Exemplo: 50000,00. Aparece como barra de progresso."
        error={errors.goal}
      />
      <SelectField
        name="visibility"
        label="Quem vê o total arrecadado"
        defaultValue={v("visibility")}
        hint="Saídas, saldo e fluxo de caixa são sempre só para integrantes. Ninguém vê quem contribuiu."
        error={errors.visibility}
      >
        {FUND_VISIBILITIES.map((option) => (
          <option key={option} value={option}>
            {VISIBILITY_LABELS[option]}
          </option>
        ))}
      </SelectField>
      <fieldset className="flex flex-col gap-4 rounded-sm border border-sepia p-4">
        <legend className="px-2 font-semibold">Como contribuir (PIX)</legend>
        <TextField name="pixKey" label="Chave PIX (opcional)" maxLength={140} defaultValue={v("pixKey")} error={errors.pixKey}
          hint="Em caixinha pública, a chave aparece para qualquer visitante. Prefira uma chave aleatória ou de CNPJ." />
        <TextField name="pixHolder" label="Favorecido (opcional)" maxLength={80} defaultValue={v("pixHolder")} error={errors.pixHolder} />
        <TextareaField
          name="pixInstructions"
          label="Orientações (opcional)"
          rows={2}
          defaultValue={v("pixInstructions")}
          error={errors.pixInstructions}
        />
      </fieldset>
      <CheckboxField name="isActive" defaultChecked={fund.isActive}>
        Caixinha ativa (aceita lançamentos e aparece para o público). Desmarque para encerrar.
      </CheckboxField>
      <div>
        <SubmitButton pendingLabel="Salvando…">{fund.id ? "Salvar caixinha" : "Criar caixinha"}</SubmitButton>
      </div>
    </form>
  );
}

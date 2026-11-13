"use client";

import { useActionState } from "react";

import { SelectField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { setShopManager } from "../actions";

export function AddShopManagerForm({ options }: { options: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(setShopManager, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <input type="hidden" name="active" value="1" />
      <SelectField name="memberId" label="Designar responsável pela loja" error={state.fieldErrors?.memberId}>
        <option value="">Escolha um integrante…</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </SelectField>
      <div>
        <SubmitButton pendingLabel="Designando…">Designar</SubmitButton>
      </div>
    </form>
  );
}

export function RemoveShopManagerForm({ memberId, name }: { memberId: string; name: string }) {
  const [state, formAction] = useActionState(setShopManager, initialFormState);
  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="active" value="0" />
      <span>{name}</span>
      <SubmitButton variant="outline" pendingLabel="Removendo…">
        Remover
      </SubmitButton>
      {state.status === "error" ? <span className="text-sm font-semibold text-vinho">{state.message}</span> : null}
    </form>
  );
}

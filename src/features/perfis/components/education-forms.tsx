"use client";

import { useActionState } from "react";

import { SelectField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { deleteEducation, saveSectionVisibility } from "../actions";
import { VISIBILITIES, VISIBILITY_LABELS, type ProfileSection, type Visibility } from "../schemas";

export function DeleteEducationButton({ id, label }: { id: string; label: string }) {
  const [state, formAction] = useActionState(deleteEducation, initialFormState);
  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="id" value={id} />
      {state.status === "error" ? <span role="alert">{state.message}</span> : null}
      <SubmitButton variant="outline" pendingLabel="Removendo…" ariaLabel={`Remover ${label}`}>
        Remover
      </SubmitButton>
    </form>
  );
}

export function SectionVisibilityForm({ section, visibility }: { section: ProfileSection; visibility: Visibility }) {
  const [state, formAction] = useActionState(saveSectionVisibility, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.message ? (
        <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>
      ) : null}
      <input type="hidden" name="section" value={section} />
      <div className="flex flex-wrap items-end gap-3">
        <SelectField name="visibility" label="Quem pode ver" defaultValue={visibility} className="w-full max-w-xs">
          {VISIBILITIES.map((option) => (
            <option key={option} value={option}>
              {VISIBILITY_LABELS[option]}
            </option>
          ))}
        </SelectField>
        <SubmitButton variant="outline" pendingLabel="Salvando…">
          Salvar visibilidade
        </SubmitButton>
      </div>
    </form>
  );
}

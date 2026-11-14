"use client";

import { useActionState } from "react";

import { TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";
import { shrinkImage } from "@/lib/shrink-image";

import { removeHousePhoto, saveHousePhoto, saveSiteContent } from "../actions";

export function SiteContentForm({ history, contactEmail }: { history: string; contactEmail: string }) {
  const [state, formAction] = useActionState(saveSiteContent, initialFormState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <TextareaField
        name="history"
        label="Nossa história"
        rows={10}
        defaultValue={state.values?.history ?? history}
        hint="Aparece na página inicial. Parágrafos separados por linha em branco."
        error={errors.history}
      />
      <TextField
        name="contactEmail"
        type="email"
        label="E-mail de contato da república"
        defaultValue={state.values?.contactEmail ?? contactEmail}
        error={errors.contactEmail}
      />
      <div>
        <SubmitButton pendingLabel="Salvando…">Salvar conteúdo</SubmitButton>
      </div>
    </form>
  );
}

export function HousePhotoForm({ hasPhoto }: { hasPhoto: boolean }) {
  const [state, formAction] = useActionState(saveHousePhoto, initialFormState);
  const [removeState, removeAction] = useActionState(removeHousePhoto, initialFormState);
  async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(await shrinkImage(file));
    event.target.files = transfer.files;
  }
  const message = state.message ? state : removeState;
  return (
    <div className="flex flex-col gap-3">
      {message.message ? <Notice tone={message.status === "error" ? "error" : "success"}>{message.message}</Notice> : null}
      <form action={formAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 font-semibold">
          {hasPhoto ? "Trocar foto da casa" : "Enviar foto da casa"}
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required onChange={onChange} className="font-normal" />
        </label>
        <div>
          <SubmitButton pendingLabel="Enviando…">Enviar foto</SubmitButton>
        </div>
      </form>
      {hasPhoto ? (
        <form action={removeAction}>
          <SubmitButton variant="outline" pendingLabel="Removendo…">
            Remover foto
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

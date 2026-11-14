"use client";

import { useActionState } from "react";

import { CheckboxField, SelectField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { deleteAnnouncement, saveAnnouncement } from "../actions";
import { VISIBILITIES, VISIBILITY_LABELS } from "../schemas";

export type AnnouncementFormValues = {
  id: string;
  title: string;
  body: string;
  visibility: (typeof VISIBILITIES)[number];
  isPinned: boolean;
  expiresOn: string;
};

const EMPTY: AnnouncementFormValues = { id: "", title: "", body: "", visibility: "members", isPinned: false, expiresOn: "" };

export function AnnouncementForm({ announcement = EMPTY }: { announcement?: AnnouncementFormValues }) {
  const [state, formAction] = useActionState(saveAnnouncement, initialFormState);
  const errors = state.fieldErrors ?? {};
  const v = (key: "title" | "body" | "visibility" | "expiresOn") => state.values?.[key] ?? announcement[key];
  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <input type="hidden" name="announcementId" value={announcement.id} />
      <TextField name="title" label="Título" required maxLength={120} defaultValue={v("title")} error={errors.title} />
      <TextareaField name="body" label="Texto" rows={8} required defaultValue={v("body")} error={errors.body} />
      <SelectField name="visibility" label="Quem pode ler" defaultValue={v("visibility")} error={errors.visibility}>
        {VISIBILITIES.map((option) => (
          <option key={option} value={option}>
            {VISIBILITY_LABELS[option]}
          </option>
        ))}
      </SelectField>
      <TextField
        name="expiresOn"
        type="date"
        label="Vale até (opcional)"
        defaultValue={v("expiresOn")}
        hint="Depois dessa data o comunicado some para os leitores; quem publica ainda vê."
        error={errors.expiresOn}
      />
      <CheckboxField name="isPinned" defaultChecked={announcement.isPinned}>
        Fixar no topo
      </CheckboxField>
      <div>
        <SubmitButton pendingLabel="Salvando…">{announcement.id ? "Salvar comunicado" : "Publicar comunicado"}</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteAnnouncementForm({ announcementId }: { announcementId: string }) {
  const [state, formAction] = useActionState(deleteAnnouncement, initialFormState);
  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="announcementId" value={announcementId} />
      <SubmitButton variant="outline" pendingLabel="Apagando…">
        Apagar comunicado
      </SubmitButton>
      {state.status === "error" ? <span className="text-sm font-semibold text-vinho">{state.message}</span> : null}
    </form>
  );
}

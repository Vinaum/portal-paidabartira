"use client";

import { useActionState } from "react";

import { SelectField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { saveEvent } from "../actions";
import {
  EVENT_STATUSES,
  EVENT_VISIBILITIES,
  STATUS_LABELS,
  VISIBILITY_LABELS,
} from "../schemas";

export type EventFormValues = {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  visibility: (typeof EVENT_VISIBILITIES)[number];
  status: (typeof EVENT_STATUSES)[number];
};

const EMPTY: EventFormValues = {
  id: "",
  title: "",
  description: "",
  location: "",
  startsAt: "",
  endsAt: "",
  visibility: "members",
  status: "draft",
};

/** Criar ou editar. Horários no fuso de Brasília. */
export function EventForm({ event = EMPTY }: { event?: EventFormValues }) {
  const [state, formAction] = useActionState(saveEvent, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  const value = (key: keyof EventFormValues) => values[key] ?? event[key];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null}
      <input type="hidden" name="eventId" value={event.id} />
      <TextField name="title" label="Título" required maxLength={120} defaultValue={value("title")} error={errors.title} />
      <TextareaField
        name="description"
        label="Descrição (opcional)"
        rows={5}
        defaultValue={value("description")}
        error={errors.description}
      />
      <TextField name="location" label="Local (opcional)" maxLength={200} defaultValue={value("location")} error={errors.location} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="startsAt"
          type="datetime-local"
          label="Começa"
          required
          defaultValue={value("startsAt")}
          hint="Horário de Brasília."
          error={errors.startsAt}
        />
        <TextField
          name="endsAt"
          type="datetime-local"
          label="Termina (opcional)"
          defaultValue={value("endsAt")}
          error={errors.endsAt}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="visibility"
          label="Quem pode ver"
          defaultValue={value("visibility")}
          hint="Eventos públicos aparecem no portal, sem login."
          error={errors.visibility}
        >
          {EVENT_VISIBILITIES.map((option) => (
            <option key={option} value={option}>
              {VISIBILITY_LABELS[option]}
            </option>
          ))}
        </SelectField>
        <SelectField
          name="status"
          label="Situação"
          defaultValue={value("status")}
          hint="Rascunho só aparece para quem gerencia eventos."
          error={errors.status}
        >
          {EVENT_STATUSES.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option]}
            </option>
          ))}
        </SelectField>
      </div>
      <div>
        <SubmitButton pendingLabel="Salvando…">{event.id ? "Salvar evento" : "Criar evento"}</SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";

import { CheckboxField, SelectField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";
import { shrinkImage } from "@/lib/shrink-image";

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
  /** Endereço do flyer atual, se houver (para mostrar e permitir remover). */
  flyerUrl?: string | null;
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
  const value = (key: Exclude<keyof EventFormValues, "flyerUrl">) => values[key] ?? event[key];

  // Reduz a imagem no navegador antes de enviar; o servidor reencoda de qualquer jeito.
  async function onFlyerChange(changeEvent: React.ChangeEvent<HTMLInputElement>) {
    const file = changeEvent.target.files?.[0];
    if (!file) return;
    const transfer = new DataTransfer();
    transfer.items.add(await shrinkImage(file, 2000));
    changeEvent.target.files = transfer.files;
  }

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
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 font-semibold">
          {event.flyerUrl ? "Trocar o flyer (opcional)" : "Flyer ou imagem de divulgação (opcional)"}
          <input
            type="file"
            name="flyer"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFlyerChange}
            aria-describedby="flyer-dica"
            aria-invalid={errors.flyer ? true : undefined}
            className="font-normal"
          />
        </label>
        <p id="flyer-dica" className="text-sm text-sepia-escuro">
          JPEG, PNG ou WebP, até 4 MB. Quem vê o evento vê o flyer: num evento público, qualquer visitante o vê.
        </p>
        {errors.flyer ? (
          <p role="alert" className="text-sm font-semibold text-vinho">
            {errors.flyer}
          </p>
        ) : null}
        {event.flyerUrl ? (
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- rota própria que confere a visibilidade; o otimizador não ajuda. */}
            <img
              src={event.flyerUrl}
              alt={`Flyer atual do evento ${event.title}`}
              className="max-h-64 w-auto max-w-full self-start rounded-sm border border-sepia"
            />
            <CheckboxField name="removeFlyer">Remover o flyer atual</CheckboxField>
          </div>
        ) : null}
      </div>
      <div>
        <SubmitButton pendingLabel="Salvando…">{event.id ? "Salvar evento" : "Criar evento"}</SubmitButton>
      </div>
    </form>
  );
}

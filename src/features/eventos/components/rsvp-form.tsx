"use client";

import { useActionState } from "react";

import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { clearRsvp, setRsvp } from "../actions";
import { RSVP_ANSWERS, RSVP_LABELS } from "../schemas";

/** Resposta de presença. Os nomes de quem vai aparecem para os integrantes. */
export function RsvpForm({
  eventId,
  current,
}: {
  eventId: string;
  current: { answer: (typeof RSVP_ANSWERS)[number]; guests: number } | null;
}) {
  const [state, formAction] = useActionState(setRsvp, initialFormState);
  const [clearState, clearAction] = useActionState(clearRsvp, initialFormState);
  const message = state.message ? state : clearState.message ? clearState : null;

  return (
    <div className="flex flex-col gap-4">
      {message ? <Notice tone={message.status === "error" ? "error" : "success"}>{message.message}</Notice> : null}
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="eventId" value={eventId} />
        <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
          <legend className="mb-1 font-semibold">Você vai?</legend>
          {RSVP_ANSWERS.map((answer) => (
            <label key={answer} className="flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="answer"
                value={answer}
                defaultChecked={current?.answer === answer}
                required
                className="h-5 w-5 accent-verde"
              />
              {RSVP_LABELS[answer]}
            </label>
          ))}
        </fieldset>
        <TextField
          name="guests"
          type="number"
          inputMode="numeric"
          min={0}
          max={10}
          label="Acompanhantes (só se você vai)"
          defaultValue={current?.guests ?? 0}
          error={state.fieldErrors?.guests}
          className="max-w-32"
        />
        <p className="text-sm text-sepia-escuro">Seu nome aparece na lista de confirmados para os integrantes.</p>
        <div>
          <SubmitButton pendingLabel="Salvando…">{current ? "Atualizar resposta" : "Responder"}</SubmitButton>
        </div>
      </form>
      {current ? (
        <form action={clearAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <SubmitButton variant="outline" pendingLabel="Removendo…">
            Remover minha resposta
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

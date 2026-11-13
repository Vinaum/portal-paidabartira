"use client";

import { useActionState } from "react";

import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { deleteDraftEvent } from "../actions";

export function DeleteDraftForm({ eventId }: { eventId: string }) {
  const [state, formAction] = useActionState(deleteDraftEvent, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}
      <input type="hidden" name="eventId" value={eventId} />
      <div>
        <SubmitButton variant="outline" pendingLabel="Apagando…">
          Apagar rascunho
        </SubmitButton>
      </div>
    </form>
  );
}

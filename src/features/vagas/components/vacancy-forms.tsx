"use client";

import { useActionState } from "react";

import { TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { deleteInterest, deleteVacancy, saveVacancy, setInterestStatus, setVacancyStatus } from "../actions";
import { INTEREST_STATUS_LABELS, INTEREST_STATUSES, type InterestStatus } from "../schemas";

function Feedback({ state }: { state: { status: string; message?: string } }) {
  return state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null;
}

type Defaults = { vacancyId: string; title: string; description: string; monthly: string; availableFrom: string };

export function VacancyForm({ defaults, submitLabel }: { defaults: Defaults; submitLabel: string }) {
  const [state, formAction] = useActionState(saveVacancy, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? defaults;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />
      <input type="hidden" name="vacancyId" value={defaults.vacancyId} />
      <TextField name="title" label="Título" required maxLength={100} defaultValue={values.title} error={errors.title} hint="Exemplo: Quarto individual, perto do ciclo básico" />
      <TextareaField
        name="description"
        label="Descrição"
        rows={5}
        required
        defaultValue={values.description}
        error={errors.description}
        hint="Aparece para qualquer visitante: não escreva telefone, CPF nem endereço completo."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="monthly" label="Valor mensal (R$, opcional)" inputMode="decimal" defaultValue={values.monthly} error={errors.monthly} hint="Exemplo: 850,00" />
        <TextField name="availableFrom" type="date" label="Disponível a partir de (opcional)" defaultValue={values.availableFrom} error={errors.availableFrom} />
      </div>
      <div>
        <SubmitButton pendingLabel="Salvando…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

export function VacancyStatusForm({ vacancyId, open }: { vacancyId: string; open: boolean }) {
  const [state, formAction] = useActionState(setVacancyStatus, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Feedback state={state} />
      <input type="hidden" name="vacancyId" value={vacancyId} />
      <input type="hidden" name="status" value={open ? "closed" : "open"} />
      <SubmitButton variant="outline" pendingLabel="Salvando…">
        {open ? "Encerrar vaga" : "Reabrir vaga"}
      </SubmitButton>
    </form>
  );
}

export function DeleteVacancyForm({ vacancyId }: { vacancyId: string }) {
  const [state, formAction] = useActionState(deleteVacancy, initialFormState);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold underline-offset-4 hover:underline">Apagar vaga</summary>
      <form action={formAction} className="mt-2 flex flex-col gap-2">
        <Feedback state={state} />
        <p>Apaga a vaga e todos os interesses recebidos nela. Não dá para desfazer.</p>
        <input type="hidden" name="vacancyId" value={vacancyId} />
        <div>
          <SubmitButton variant="outline" pendingLabel="Apagando…">
            Confirmar exclusão
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}

export function InterestActions({ interestId, status }: { interestId: string; status: InterestStatus }) {
  const [state, formAction] = useActionState(setInterestStatus, initialFormState);
  const [removed, removeAction] = useActionState(deleteInterest, initialFormState);
  return (
    <div className="flex flex-col gap-2">
      <Feedback state={state} />
      <Feedback state={removed} />
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="interestId" value={interestId} />
        {INTEREST_STATUSES.filter((option) => option !== status).map((option) => (
          <button key={option} type="submit" name="status" value={option} className="min-h-11 rounded-sm border-2 border-preto px-3 py-2 text-sm font-semibold hover:bg-papel">
            Marcar como {INTEREST_STATUS_LABELS[option].toLowerCase()}
          </button>
        ))}
      </form>
      <form action={removeAction}>
        <input type="hidden" name="interestId" value={interestId} />
        <button type="submit" className="min-h-11 text-sm font-semibold underline underline-offset-4">
          Apagar este interesse
        </button>
      </form>
    </div>
  );
}

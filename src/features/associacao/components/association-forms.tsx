"use client";

import { useActionState } from "react";

import { SelectField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import {
  addDocument,
  addEntry,
  applyToAssociation,
  decideDue,
  decideMember,
  informDue,
  removeDocument,
  reverseEntry,
  saveSettings,
} from "../actions";
import { DOC_KINDS, DOC_KIND_LABELS, EXPENSE_CATEGORIES } from "../schemas";

function Feedback({ state }: { state: { status: string; message?: string } }) {
  return state.message ? <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice> : null;
}

export function ApplyForm({ label = "Pedir para ser associado" }: { label?: string }) {
  const [state, formAction] = useActionState(() => applyToAssociation(), initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Feedback state={state} />
      <div>
        <SubmitButton pendingLabel="Enviando…">{label}</SubmitButton>
      </div>
    </form>
  );
}

export function InformDueForm({ currentMonth, suggested }: { currentMonth: string; suggested: string }) {
  const [state, formAction] = useActionState(informDue, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="month"
          type="month"
          label="Mês pago"
          required
          max={currentMonth}
          defaultValue={values.month ?? currentMonth}
          error={errors.month}
        />
        <TextField
          name="amount"
          label="Valor pago (R$)"
          inputMode="decimal"
          required
          defaultValue={values.amount ?? suggested}
          hint="Exemplo: 50,00"
          error={errors.amount}
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Enviando…">Já paguei</SubmitButton>
      </div>
    </form>
  );
}

/** Botões de decisão sobre um associado: aprovar, recusar ou registrar a saída. */
export function DecideMemberForm({ memberId, options }: { memberId: string; options: { status: string; label: string; primary?: boolean }[] }) {
  const [state, formAction] = useActionState(decideMember, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Feedback state={state} />
      <input type="hidden" name="memberId" value={memberId} />
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.status}
            type="submit"
            name="status"
            value={option.status}
            className={`min-h-11 rounded-sm px-4 py-2 font-semibold ${
              option.primary ? "bg-verde text-creme hover:bg-musgo" : "border-2 border-preto hover:bg-papel"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </form>
  );
}

export function DecideDueForm({ dueId }: { dueId: string }) {
  const [state, formAction] = useActionState(decideDue, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Feedback state={state} />
      <input type="hidden" name="dueId" value={dueId} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="confirm" value="yes" className="min-h-11 rounded-sm bg-verde px-4 py-2 font-semibold text-creme hover:bg-musgo">
          PIX recebido: confirmar
        </button>
        <button type="submit" name="confirm" value="no" className="min-h-11 rounded-sm border-2 border-preto px-4 py-2 font-semibold hover:bg-papel">
          Não encontrei o PIX
        </button>
      </div>
    </form>
  );
}

export function AddEntryForm({ today }: { today: string }) {
  const [state, formAction] = useActionState(addEntry, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />
      <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
        <legend className="mb-1 font-semibold">Tipo</legend>
        {[
          ["income", "Entrada"],
          ["expense", "Saída"],
        ].map(([value, label]) => (
          <label key={value} className="flex min-h-11 items-center gap-2">
            <input type="radio" name="kind" value={value} defaultChecked={(values.kind ?? "expense") === value} className="h-5 w-5 accent-verde" required />
            {label}
          </label>
        ))}
        {errors.kind ? <p className="w-full text-sm font-semibold text-vinho">{errors.kind}</p> : null}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="amount" label="Valor (R$)" inputMode="decimal" required defaultValue={values.amount ?? ""} hint="Exemplo: 150,00" error={errors.amount} />
        <TextField name="occurredOn" type="date" label="Data" required max={today} defaultValue={values.occurredOn ?? today} error={errors.occurredOn} />
      </div>
      <SelectField name="category" label="Categoria (obrigatória para saída)" defaultValue={values.category ?? ""} error={errors.category}>
        <option value="">—</option>
        {EXPENSE_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </SelectField>
      <TextareaField
        name="description"
        label="Descrição"
        rows={2}
        required
        defaultValue={values.description ?? ""}
        hint="Saídas aparecem, com esta descrição, para todos os associados. Entradas aparecem só somadas por mês: não escreva o nome de quem contribuiu."
        error={errors.description}
      />
      <div>
        <SubmitButton pendingLabel="Registrando…">Registrar lançamento</SubmitButton>
      </div>
    </form>
  );
}

export function ReverseEntryForm({ entryId }: { entryId: string }) {
  const [state, formAction] = useActionState(reverseEntry, initialFormState);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold underline-offset-4 hover:underline">Estornar</summary>
      <form action={formAction} className="mt-2 flex flex-col gap-2">
        <Feedback state={state} />
        <input type="hidden" name="entryId" value={entryId} />
        <TextField name="reason" label="Motivo do estorno" maxLength={160} required error={state.fieldErrors?.reason} />
        <div>
          <SubmitButton variant="outline" pendingLabel="Estornando…">
            Confirmar estorno
          </SubmitButton>
        </div>
      </form>
    </details>
  );
}

export function SettingsForm({ defaults }: { defaults: { pixKey: string; pixHolder: string; pixInstructions: string; monthly: string } }) {
  const [state, formAction] = useActionState(saveSettings, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? defaults;
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="pixKey" label="Chave PIX" defaultValue={values.pixKey} error={errors.pixKey} hint="E-mail, celular com +55, CPF, CNPJ ou chave aleatória." />
        <TextField name="pixHolder" label="Favorecido" maxLength={80} defaultValue={values.pixHolder} error={errors.pixHolder} />
      </div>
      <TextField name="monthly" label="Mensalidade sugerida (R$)" inputMode="decimal" defaultValue={values.monthly} error={errors.monthly} hint="Preenche o valor no aviso de pagamento. Deixe vazio se não houver." />
      <TextareaField name="pixInstructions" label="Instruções (opcional)" rows={2} defaultValue={values.pixInstructions} error={errors.pixInstructions} />
      <div>
        <SubmitButton pendingLabel="Salvando…">Salvar configuração</SubmitButton>
      </div>
    </form>
  );
}

export function AddDocumentForm({ today }: { today: string }) {
  const [state, formAction] = useActionState(addDocument, initialFormState);
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="kind" label="Tipo" defaultValue={values.kind ?? "ata"} error={errors.kind}>
          {DOC_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {DOC_KIND_LABELS[kind]}
            </option>
          ))}
        </SelectField>
        <TextField name="docDate" type="date" label="Data do documento" required max={today} defaultValue={values.docDate ?? today} error={errors.docDate} />
      </div>
      <TextField name="title" label="Título" required maxLength={120} defaultValue={values.title ?? ""} error={errors.title} />
      <TextareaField name="description" label="Descrição (opcional)" rows={2} defaultValue={values.description ?? ""} error={errors.description} />
      <TextField
        name="file"
        type="file"
        label="Arquivo PDF (até 8 MB)"
        accept="application/pdf"
        required
        error={errors.file}
        hint="Os associados veem este arquivo. Não envie documentos com dados pessoais de terceiros (CPF, endereço, telefone)."
      />
      <div>
        <SubmitButton pendingLabel="Enviando…">Publicar documento</SubmitButton>
      </div>
    </form>
  );
}

export function RemoveDocumentForm({ documentId }: { documentId: string }) {
  const [state, formAction] = useActionState(removeDocument, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Feedback state={state} />
      <input type="hidden" name="documentId" value={documentId} />
      <SubmitButton variant="outline" pendingLabel="Removendo…">
        Remover
      </SubmitButton>
    </form>
  );
}

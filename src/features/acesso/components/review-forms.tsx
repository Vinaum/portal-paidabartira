"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { CheckboxField, SelectField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState, type FormState } from "@/lib/form";
import { CATEGORY_LABELS, MEMBER_CATEGORIES, ROLE_LABELS, type MemberRole } from "@/lib/permissions";

import { createInvitation, reviewRequest } from "../actions";

function Feedback({ state }: { state: FormState }) {
  if (!state.message) return null;
  return <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>;
}

export function ApproveForm({
  requestId,
  assignableRoles,
}: {
  requestId: string;
  assignableRoles: MemberRole[];
}) {
  const [state, formAction] = useActionState(reviewRequest, initialFormState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />
      <input type="hidden" name="action" value="approve" />
      <input type="hidden" name="requestId" value={requestId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="category" label="Categoria" required defaultValue="" error={errors.category}>
          <option value="" disabled>
            Escolha…
          </option>
          {MEMBER_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </SelectField>
        <SelectField
          name="role"
          label="Papel"
          defaultValue="membro"
          hint="Você só vê os papéis que pode conceder."
          error={errors.role}
        >
          {assignableRoles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </SelectField>
      </div>
      <CheckboxField name="isFounder" error={errors.isFounder}>
        É fundador da república (só para ex-moradores)
      </CheckboxField>
      <TextareaField name="adminNotes" label="Observações internas (opcional)" rows={2} error={errors.adminNotes} />
      <div>
        <SubmitButton pendingLabel="Aprovando…">Aprovar</SubmitButton>
      </div>
    </form>
  );
}

export function RequestInfoForm({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState(reviewRequest, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />
      <input type="hidden" name="action" value="request_info" />
      <input type="hidden" name="requestId" value={requestId} />
      <TextareaField
        name="infoRequest"
        label="O que falta saber"
        rows={3}
        required
        hint="Fica registrado aqui. O contato com a pessoa é feito por você, pelo e-mail ou telefone informado."
        error={state.fieldErrors?.infoRequest}
      />
      <div>
        <SubmitButton variant="outline">Registrar pedido de informações</SubmitButton>
      </div>
    </form>
  );
}

export function RejectForm({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState(reviewRequest, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />
      <input type="hidden" name="action" value="reject" />
      <input type="hidden" name="requestId" value={requestId} />
      <TextareaField
        name="adminNotes"
        label="Motivo interno (opcional)"
        rows={2}
        hint="Não é enviado à pessoa."
        error={state.fieldErrors?.adminNotes}
      />
      <div>
        <SubmitButton variant="outline" pendingLabel="Rejeitando…">
          Rejeitar
        </SubmitButton>
      </div>
    </form>
  );
}

export function ReopenForm({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState(reviewRequest, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Feedback state={state} />
      <input type="hidden" name="action" value="reopen" />
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <SubmitButton variant="outline">Voltar para análise</SubmitButton>
      </div>
    </form>
  );
}

export function InvitationForm({ requestId, resend }: { requestId: string; resend: boolean }) {
  const [state, formAction] = useActionState(createInvitation, initialFormState);
  const [copied, setCopied] = useState(false);
  const invitePath = state.data?.invitePath;
  const inviteUrl = invitePath && typeof window !== "undefined" ? window.location.origin + invitePath : null;

  return (
    <div className="flex flex-col gap-4">
      <Feedback state={state} />
      {inviteUrl ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="invite-url" className="font-semibold">
            Link de convite
          </label>
          <input
            id="invite-url"
            readOnly
            value={inviteUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="block min-h-11 w-full rounded-sm border-2 border-verde bg-creme px-3 py-2 font-mono text-sm"
          />
          <div className="flex items-center gap-3">
            <Button
              variant="dark"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteUrl);
                setCopied(true);
              }}
            >
              Copiar link
            </Button>
            <span role="status" className="text-sm">
              {copied ? "Copiado." : ""}
            </span>
          </div>
          <p className="text-sm text-sepia-escuro">
            O link dá acesso à criação da conta: envie só para a pessoa convidada. Ele expira e deixa de
            valer se você gerar outro.
          </p>
        </div>
      ) : null}
      <form action={formAction} className="flex flex-wrap gap-3">
        <input type="hidden" name="requestId" value={requestId} />
        <SubmitButton pendingLabel="Gerando…">
          {resend ? "Gerar novo link de convite" : "Gerar link de convite"}
        </SubmitButton>
        <input type="hidden" name="mode" value="link" />
      </form>
      <form action={formAction} className="flex flex-wrap gap-3">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="mode" value="email" />
        <SubmitButton variant="outline" pendingLabel="Enviando…">
          {resend ? "Reenviar convite por e-mail" : "Enviar convite por e-mail"}
        </SubmitButton>
      </form>
    </div>
  );
}

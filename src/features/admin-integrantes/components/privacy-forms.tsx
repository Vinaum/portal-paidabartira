"use client";

import { useActionState } from "react";

import { SelectField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState, type FormState } from "@/lib/form";

import { executeAccountDeletion, resolveDataRequest } from "../actions";
import { DELETE_CONFIRMATION } from "../schemas";

function Feedback({ state }: { state: FormState }) {
  if (!state.message) return null;
  return <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>;
}

export function ResolveRequestForm({ requestId, inProgress }: { requestId: string; inProgress: boolean }) {
  const [state, formAction] = useActionState(resolveDataRequest, initialFormState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />
      <input type="hidden" name="requestId" value={requestId} />
      <SelectField name="status" label="Situação do pedido" defaultValue={inProgress ? "done" : "in_progress"}>
        {inProgress ? null : <option value="in_progress">Em análise</option>}
        <option value="done">Atendido</option>
        <option value="rejected">Recusado</option>
      </SelectField>
      <TextareaField
        name="resolution"
        label="Resposta ao titular"
        rows={3}
        hint="Obrigatória para atendido ou recusado. Fica registrada no pedido; o contato com a pessoa é feito por você."
        error={errors.resolution}
      />
      <div>
        <SubmitButton variant="outline" pendingLabel="Salvando…">
          Salvar
        </SubmitButton>
      </div>
    </form>
  );
}

export function DeleteAccountForm({ requestId, memberName }: { requestId: string; memberName: string }) {
  const [state, formAction] = useActionState(executeAccountDeletion, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-4 border-t border-sepia pt-4">
      <Feedback state={state} />
      <input type="hidden" name="requestId" value={requestId} />
      <p>
        Executar a exclusão apaga <strong>{memberName}</strong>: login, perfil, foto, formação, períodos e a solicitação
        de acesso original. <strong>Não há como desfazer.</strong> O pedido some junto com a conta; ficam só os registros
        de auditoria, sem texto livre.
      </p>
      <TextField
        name="confirmation"
        label={`Digite ${DELETE_CONFIRMATION} para confirmar`}
        autoComplete="off"
        error={state.fieldErrors?.confirmation}
      />
      <div>
        <SubmitButton variant="dark" pendingLabel="Excluindo…">
          Excluir a conta agora
        </SubmitButton>
      </div>
    </form>
  );
}

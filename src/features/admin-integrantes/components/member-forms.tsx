"use client";

import { useActionState } from "react";

import { CheckboxField, SelectField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState, type FormState } from "@/lib/form";
import {
  CATEGORY_LABELS,
  MEMBER_CATEGORIES,
  MEMBER_STATUSES,
  ROLE_LABELS,
  type MemberCategory,
  type MemberRole,
  type MemberStatus,
} from "@/lib/permissions";

import { setMemberRole, updateMember } from "../actions";
import { STATUS_LABELS } from "../schemas";

function Feedback({ state }: { state: FormState }) {
  if (!state.message) return null;
  return <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>;
}

export function UpdateMemberForm({
  memberId,
  category,
  isFounder,
  status,
}: {
  memberId: string;
  category: MemberCategory;
  isFounder: boolean;
  status: MemberStatus;
}) {
  const [state, formAction] = useActionState(updateMember, initialFormState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />
      <input type="hidden" name="memberId" value={memberId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="category" label="Categoria" defaultValue={category} error={errors.category}>
          {MEMBER_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </option>
          ))}
        </SelectField>
        <SelectField
          name="status"
          label="Situação"
          defaultValue={status}
          hint="Suspender ou desativar bloqueia o acesso na hora, inclusive o login."
          error={errors.status}
        >
          {MEMBER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </SelectField>
      </div>
      <CheckboxField name="isFounder" defaultChecked={isFounder} error={errors.isFounder}>
        É fundador da república (só para ex-moradores)
      </CheckboxField>
      <TextareaField
        name="reason"
        label="Motivo (opcional)"
        rows={2}
        hint="Fica no histórico do integrante."
        error={errors.reason}
      />
      <div>
        <SubmitButton pendingLabel="Salvando…">Salvar alterações</SubmitButton>
      </div>
    </form>
  );
}

export function RoleForm({
  memberId,
  role,
  assignableRoles,
}: {
  memberId: string;
  role: MemberRole;
  assignableRoles: MemberRole[];
}) {
  const [state, formAction] = useActionState(setMemberRole, initialFormState);
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Feedback state={state} />
      <input type="hidden" name="memberId" value={memberId} />
      <SelectField
        name="role"
        label="Papel"
        defaultValue={role}
        hint="Você só vê os papéis que pode conceder."
        error={errors.role}
      >
        {assignableRoles.map((value) => (
          <option key={value} value={value}>
            {ROLE_LABELS[value]}
          </option>
        ))}
      </SelectField>
      <TextareaField name="reason" label="Motivo (opcional)" rows={2} error={errors.reason} />
      <div>
        <SubmitButton variant="dark" pendingLabel="Salvando…">
          Trocar papel
        </SubmitButton>
      </div>
    </form>
  );
}

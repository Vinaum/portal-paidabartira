"use client";

import Link from "next/link";
import { useActionState } from "react";

import { CheckboxField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { expressInterest } from "../actions";
import { INTEREST_RETENTION_DAYS } from "../schemas";

export function InterestForm({ vacancyId }: { vacancyId: string }) {
  const [state, formAction] = useActionState(expressInterest, initialFormState);
  if (state.status === "success") return <Notice tone="success">{state.message}</Notice>;
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}
      {Object.keys(errors).length > 0 ? <Notice tone="error">Confira os campos destacados.</Notice> : null}
      <input type="hidden" name="vacancyId" value={vacancyId} />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="name" label="Nome completo" autoComplete="name" required defaultValue={values.name} error={errors.name} />
        <TextField name="course" label="Curso ou ocupação (opcional)" defaultValue={values.course} error={errors.course} />
        <TextField name="email" type="email" label="E-mail" autoComplete="email" required defaultValue={values.email} error={errors.email} />
        <TextField name="phone" type="tel" label="Telefone ou WhatsApp (opcional)" autoComplete="tel" defaultValue={values.phone} error={errors.phone} />
      </div>
      <TextareaField
        name="message"
        label="Conte um pouco sobre você (opcional)"
        rows={4}
        defaultValue={values.message}
        error={errors.message}
        hint="Por exemplo: quando precisa da vaga e como conheceu a república. Não escreva CPF nem endereço."
      />

      {/* Campo-isca contra robôs: escondido de pessoas e de leitores de tela. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="website">Não preencha este campo</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <CheckboxField name="consent" required error={errors.consent}>
        Li e aceito a{" "}
        <Link href="/privacidade" className="font-semibold underline" target="_blank">
          política de privacidade
        </Link>{" "}
        e autorizo a república a usar estes dados para entrar em contato sobre a vaga. Eles são apagados em até{" "}
        {INTEREST_RETENTION_DAYS} dias.
      </CheckboxField>

      <div>
        <SubmitButton pendingLabel="Enviando…">Tenho interesse</SubmitButton>
      </div>
    </form>
  );
}

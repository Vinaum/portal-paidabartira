"use client";

import Link from "next/link";
import { useActionState } from "react";

import { CheckboxField, TextareaField } from "@/components/ui/form-fields";
import { Notice } from "@/components/ui/notice";
import { TextField } from "@/components/ui/text-field";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/lib/form";

import { submitAccessRequest } from "../actions";

export function AccessRequestForm() {
  const [state, formAction] = useActionState(submitAccessRequest, initialFormState);

  if (state.status === "success") {
    return <Notice tone="success">{state.message}</Notice>;
  }
  const errors = state.fieldErrors ?? {};
  const values = state.values ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.message ? <Notice tone="error">{state.message}</Notice> : null}
      {Object.keys(errors).length > 0 ? (
        <Notice tone="error">Confira os campos destacados.</Notice>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="fullName"
          defaultValue={values.fullName} label="Nome completo" autoComplete="name" required error={errors.fullName} />
        <TextField
          name="nickname"
          defaultValue={values.nickname}
          label="Apelido (opcional)"
          hint="Como você é conhecido na república."
          error={errors.nickname}
        />
        <TextField
          name="email"
          defaultValue={values.email}
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          hint="Será seu e-mail de login se o acesso for aprovado."
          error={errors.email}
        />
        <TextField name="phone"
          defaultValue={values.phone} label="Telefone (opcional)" type="tel" autoComplete="tel" error={errors.phone} />
      </div>

      <TextField
        name="relationship"
          defaultValue={values.relationship}
        label="Relação com a república"
        required
        hint="Por exemplo: morador atual, ex-morador (2010 a 2014), amigo da casa."
        error={errors.relationship}
      />
      <TextareaField
        name="justification"
          defaultValue={values.justification}
        label="Conte sobre o seu vínculo"
        required
        hint="Ajuda a administração a reconhecer você: época, quarto, quem morava junto."
        error={errors.justification}
      />
      <TextareaField name="extraInfo"
          defaultValue={values.extraInfo} label="Informações adicionais (opcional)" rows={3} error={errors.extraInfo} />

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
        e autorizo o uso destes dados para a análise do meu pedido.
      </CheckboxField>

      <div>
        <SubmitButton>Enviar solicitação</SubmitButton>
      </div>
    </form>
  );
}

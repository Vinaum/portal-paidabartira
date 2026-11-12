"use server";

import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

import {
  confirmLinkSchema,
  fieldErrorsFrom,
  passwordResetRequestSchema,
  setPasswordSchema,
  signInSchema,
  type FormState,
} from "./schemas";

/** Mensagem única para qualquer falha de login: não revela se o e-mail existe. */
const INVALID_CREDENTIALS = "E-mail ou senha incorretos.";

export async function signIn(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { status: "error", message: INVALID_CREDENTIALS };
  }

  redirect(safeNextPath(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = passwordResetRequestSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  // O link do e-mail é montado pelo modelo configurado no Supabase a partir
  // da URL do site (docs/supabase.md), nunca a partir de cabeçalhos da
  // requisição. O resultado é ignorado de propósito: a resposta é a mesma
  // exista ou não uma conta com este e-mail.
  await supabase.auth.resetPasswordForEmail(parsed.data.email);

  return {
    status: "success",
    message:
      "Se houver uma conta com este e-mail, enviamos um link para definir uma nova senha.",
  };
}

/**
 * Define a senha (convite ou recuperação) e, no caso de convite, ativa o
 * vínculo. `activate_membership` não recebe parâmetros: categoria, fundador
 * e papel vêm da solicitação aprovada pelo administrador.
 */
export async function setPassword(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) {
    return {
      status: "error",
      message: "O link expirou ou já foi usado. Peça um novo link.",
    };
  }

  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const { error: passwordError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (passwordError) {
    return {
      status: "error",
      message: "Não foi possível salvar a senha. Tente outra senha ou peça um novo link.",
    };
  }

  const { error: activationError } = await supabase.rpc("activate_membership");
  if (activationError) {
    return {
      status: "error",
      message:
        "Senha salva, mas não há convite válido para esta conta. Fale com a administração da república.",
    };
  }

  redirect("/painel");
}

/**
 * Troca o código do link de e-mail (convite, recuperação, troca de e-mail)
 * por uma sessão. É uma ação disparada por botão, e não um GET automático,
 * para que antivírus e pré-visualizadores de e-mail não consumam o link.
 */
export async function confirmEmailLink(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = confirmLinkSchema.safeParse({
    token_hash: formData.get("token_hash"),
    type: formData.get("type"),
  });
  const invalid: FormState = {
    status: "error",
    message: "Este link é inválido, expirou ou já foi usado. Peça um novo.",
  };
  if (!parsed.success) return invalid;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp(parsed.data);
  if (error) return invalid;

  const needsPassword =
    parsed.data.type === "invite" || parsed.data.type === "recovery";
  redirect(needsPassword ? "/definir-senha" : "/painel");
}

"use server";

import { revalidatePath } from "next/cache";

import { POLICY_VERSION } from "@/features/acesso/schemas";
import { requirePermission } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/form";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

import { interestIdSchema, interestSchema, interestStatusSchema, vacancyIdSchema, vacancySchema, vacancyStatusSchema } from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function friendly(error: { code?: string; message?: string }): string {
  if (error.code === "42501") return "Você não tem permissão para esta ação.";
  return "Não foi possível concluir. Confira os dados e tente de novo.";
}

function revalidateVacancies() {
  revalidatePath("/vagas", "layout");
  revalidatePath("/admin/vagas", "layout");
}

const RECEIVED: FormState = {
  status: "success",
  message: "Recebemos o seu interesse. A república entra em contato pelo e-mail ou telefone informado.",
};

/** Formulário público (sem login). Não revela se o e-mail já tinha demonstrado interesse. */
export async function expressInterest(_previous: FormState, formData: FormData): Promise<FormState> {
  // Campo-isca: pessoas não o veem; robôs costumam preencher. Finge sucesso.
  if (text(formData, "website") !== "") return RECEIVED;

  const values = {
    vacancyId: text(formData, "vacancyId"),
    name: text(formData, "name"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    course: text(formData, "course"),
    message: text(formData, "message"),
  };
  const parsed = interestSchema.safeParse({ ...values, consent: formData.get("consent") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vacancy_express_interest", {
    p_vacancy_id: parsed.data.vacancyId,
    p_name: parsed.data.name,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone,
    p_course: parsed.data.course,
    p_message: parsed.data.message,
    p_policy_version: POLICY_VERSION,
  });
  if (error) {
    return { status: "error", message: "Não foi possível enviar agora. Confira os dados e tente de novo em alguns minutos.", values };
  }
  if (data === "closed") return { status: "error", message: "Esta vaga foi encerrada.", values };
  if (data === "throttled") {
    return { status: "error", message: "Recebemos muitos envios na última hora. Tente novamente mais tarde.", values };
  }
  return RECEIVED;
}

export async function saveVacancy(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.vacanciesManage);
  const values = {
    vacancyId: text(formData, "vacancyId"),
    title: text(formData, "title"),
    description: text(formData, "description"),
    monthly: text(formData, "monthly"),
    availableFrom: text(formData, "availableFrom"),
  };
  const parsed = vacancySchema.safeParse({ ...values, vacancyId: values.vacancyId === "" ? null : values.vacancyId });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("vacancy_save", {
    p_id: parsed.data.vacancyId,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_monthly_cents: parsed.data.monthly,
    p_available_from: parsed.data.availableFrom,
  });
  if (error) return { status: "error", message: friendly(error), values };
  revalidateVacancies();
  return { status: "success", message: parsed.data.vacancyId ? "Vaga atualizada." : "Vaga publicada." };
}

export async function setVacancyStatus(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.vacanciesManage);
  const parsed = vacancyStatusSchema.safeParse({ vacancyId: text(formData, "vacancyId"), status: text(formData, "status") });
  if (!parsed.success) return { status: "error", message: "Pedido inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("vacancy_set_status", { p_id: parsed.data.vacancyId, p_status: parsed.data.status });
  if (error) return { status: "error", message: friendly(error) };
  revalidateVacancies();
  return { status: "success", message: parsed.data.status === "open" ? "Vaga reaberta." : "Vaga encerrada." };
}

export async function deleteVacancy(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.vacanciesManage);
  const parsed = vacancyIdSchema.safeParse({ vacancyId: text(formData, "vacancyId") });
  if (!parsed.success) return { status: "error", message: "Pedido inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("vacancy_delete", { p_id: parsed.data.vacancyId });
  if (error) return { status: "error", message: friendly(error) };
  revalidateVacancies();
  return { status: "success", message: "Vaga apagada, junto com os interesses recebidos." };
}

export async function setInterestStatus(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.vacanciesManage);
  const parsed = interestStatusSchema.safeParse({ interestId: text(formData, "interestId"), status: text(formData, "status") });
  if (!parsed.success) return { status: "error", message: "Pedido inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("vacancy_set_interest_status", { p_id: parsed.data.interestId, p_status: parsed.data.status });
  if (error) return { status: "error", message: friendly(error) };
  revalidateVacancies();
  return { status: "success", message: "Situação atualizada." };
}

export async function deleteInterest(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.vacanciesManage);
  const parsed = interestIdSchema.safeParse({ interestId: text(formData, "interestId") });
  if (!parsed.success) return { status: "error", message: "Pedido inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("vacancy_delete_interest", { p_id: parsed.data.interestId });
  if (error) return { status: "error", message: friendly(error) };
  revalidateVacancies();
  return { status: "success", message: "Interesse apagado." };
}

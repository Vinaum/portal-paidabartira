"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActiveMember, requirePermission } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/form";
import { todayInBrasilia } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

import { entrySchema, fundSchema, managerSchema, reverseSchema } from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

/** Mensagens do próprio banco (em português) passam; o resto vira texto genérico. */
function friendly(error: { code?: string; message?: string }): string {
  if (error.code === "42501") return "Você não tem permissão para esta ação.";
  if (error.code === "23505") return "Este lançamento já foi estornado.";
  if (error.code === "23514" && error.message && !/violates|constraint/i.test(error.message)) return error.message;
  return "Não foi possível concluir. Confira os dados e tente de novo.";
}

function revalidateFinance(fundId?: string) {
  revalidatePath("/financeiro", "layout");
  revalidatePath("/caixinha");
  if (fundId) revalidatePath(`/financeiro/${fundId}`, "layout");
}

export async function saveFund(_previous: FormState, formData: FormData): Promise<FormState> {
  const manager = await requirePermission(PERMISSIONS.financeWrite);
  const values = {
    fundId: text(formData, "fundId"),
    name: text(formData, "name"),
    description: text(formData, "description"),
    goal: text(formData, "goal"),
    visibility: text(formData, "visibility"),
    pixKey: text(formData, "pixKey"),
    pixHolder: text(formData, "pixHolder"),
    pixInstructions: text(formData, "pixInstructions"),
  };
  const parsed = fundSchema.safeParse({ ...values, isActive: formData.get("isActive") === "on" });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const input = parsed.data;

  const supabase = await createClient();
  const fields = {
    name: input.name,
    description: input.description,
    goal_cents: input.goal,
    visibility: input.visibility,
    pix_key: input.pixKey,
    pix_holder: input.pixHolder,
    pix_instructions: input.pixInstructions,
    is_active: input.isActive,
  };

  if (input.fundId) {
    const { data, error } = await supabase.from("funds").update(fields).eq("id", input.fundId).select("id");
    if (error || !data?.length) return { status: "error", message: "Não foi possível salvar a caixinha.", values };
    revalidateFinance(input.fundId);
    return { status: "success", message: "Caixinha salva." };
  }

  const { data, error } = await supabase
    .from("funds")
    .insert({ ...fields, created_by: manager.id })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: "Não foi possível criar a caixinha.", values };
  revalidateFinance();
  redirect(`/financeiro/${data.id}/gerenciar?criada=1`);
}

export async function addEntry(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActiveMember();
  const values = {
    fundId: text(formData, "fundId"),
    kind: text(formData, "kind"),
    amount: text(formData, "amount"),
    occurredOn: text(formData, "occurredOn"),
    category: text(formData, "category"),
    description: text(formData, "description"),
  };
  const parsed = entrySchema(todayInBrasilia()).safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const input = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("finance_add_entry", {
    p_fund_id: input.fundId,
    p_kind: input.kind,
    p_amount_cents: input.amount,
    p_occurred_on: input.occurredOn,
    p_category: input.category,
    p_description: input.description,
  });
  if (error) return { status: "error", message: friendly(error), values };

  revalidateFinance(input.fundId);
  return { status: "success", message: "Lançamento registrado." };
}

export async function reverseEntry(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActiveMember();
  const parsed = reverseSchema.safeParse({
    entryId: text(formData, "entryId"),
    fundId: text(formData, "fundId"),
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("finance_reverse_entry", {
    p_entry_id: parsed.data.entryId,
    p_reason: parsed.data.reason,
  });
  if (error) return { status: "error", message: friendly(error) };

  revalidateFinance(parsed.data.fundId);
  return { status: "success", message: "Lançamento estornado." };
}

export async function setFundManager(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.financeWrite);
  const parsed = managerSchema.safeParse({
    fundId: text(formData, "fundId"),
    memberId: text(formData, "memberId"),
    active: formData.get("active") === "1",
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("finance_set_fund_manager", {
    p_fund_id: parsed.data.fundId,
    p_member_id: parsed.data.memberId,
    p_active: parsed.data.active,
  });
  if (error) return { status: "error", message: friendly(error) };

  revalidateFinance(parsed.data.fundId);
  return { status: "success", message: parsed.data.active ? "Responsável designado." : "Responsável removido." };
}

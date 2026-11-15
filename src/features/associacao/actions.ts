"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireActiveMember, requirePermission } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/form";
import { PERMISSIONS } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { ASSOCIATION_BUCKET } from "./queries";
import {
  checkPdf,
  decideMemberSchema,
  documentSchema,
  dueIdSchema,
  dueSchema,
  entrySchema,
  removeDocumentSchema,
  reverseSchema,
  settingsSchema,
} from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

/** Mensagens do próprio banco (em português) passam; o resto vira texto genérico. */
function friendly(error: { code?: string; message?: string }): string {
  if (error.code === "42501") return "Você não tem permissão para esta ação.";
  if ((error.code === "23514" || error.code === "no_data_found" || error.code === "P0002") && error.message && !/violates|constraint/i.test(error.message)) {
    return error.message;
  }
  return "Não foi possível concluir. Confira os dados e tente de novo.";
}

function revalidateAssociation() {
  revalidatePath("/associacao", "layout");
  revalidatePath("/admin/associacao", "layout");
}

// --- Integrante -----------------------------------------------------------------------------
export async function applyToAssociation(): Promise<FormState> {
  await requireActiveMember();
  const supabase = await createClient();
  const { error } = await supabase.rpc("association_apply");
  if (error) return { status: "error", message: friendly(error) };
  revalidateAssociation();
  return { status: "success", message: "Pedido enviado. A administração vai analisar." };
}

export async function informDue(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActiveMember();
  const values = { month: text(formData, "month"), amount: text(formData, "amount") };
  const parsed = dueSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("association_inform_due", {
    p_month: parsed.data.month,
    p_amount_cents: parsed.data.amount,
  });
  if (error) return { status: "error", message: friendly(error), values };
  revalidateAssociation();
  return { status: "success", message: "Pagamento informado. A tesouraria vai conferir o PIX." };
}

// --- Gestão ---------------------------------------------------------------------------------
export async function decideMember(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.associationManage);
  const parsed = decideMemberSchema.safeParse({ memberId: text(formData, "memberId"), status: text(formData, "status") });
  if (!parsed.success) return { status: "error", message: "Pedido inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("association_decide", { p_member_id: parsed.data.memberId, p_status: parsed.data.status });
  if (error) return { status: "error", message: friendly(error) };
  revalidateAssociation();
  return { status: "success", message: "Situação atualizada." };
}

export async function decideDue(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.associationManage);
  const parsed = dueIdSchema.safeParse({ dueId: text(formData, "dueId"), confirm: text(formData, "confirm") });
  if (!parsed.success) return { status: "error", message: "Pedido inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("association_decide_due", {
    p_due_id: parsed.data.dueId,
    p_confirm: parsed.data.confirm === "yes",
  });
  if (error) return { status: "error", message: friendly(error) };
  revalidateAssociation();
  return { status: "success", message: parsed.data.confirm === "yes" ? "Mensalidade confirmada." : "Mensalidade recusada." };
}

export async function addEntry(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.associationManage);
  const values = {
    kind: text(formData, "kind"),
    amount: text(formData, "amount"),
    occurredOn: text(formData, "occurredOn"),
    category: text(formData, "category"),
    description: text(formData, "description"),
  };
  const parsed = entrySchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const input = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("association_add_entry", {
    p_kind: input.kind,
    p_amount_cents: input.amount,
    p_occurred_on: input.occurredOn,
    p_category: input.category,
    p_description: input.description,
  });
  if (error) return { status: "error", message: friendly(error), values };
  revalidateAssociation();
  return { status: "success", message: "Lançamento registrado." };
}

export async function reverseEntry(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.associationManage);
  const parsed = reverseSchema.safeParse({ entryId: text(formData, "entryId"), reason: text(formData, "reason") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("association_reverse_entry", {
    p_entry_id: parsed.data.entryId,
    p_reason: parsed.data.reason,
  });
  if (error) return { status: "error", message: friendly(error) };
  revalidateAssociation();
  return { status: "success", message: "Lançamento estornado." };
}

export async function saveSettings(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.associationManage);
  const values = {
    pixKey: text(formData, "pixKey"),
    pixHolder: text(formData, "pixHolder"),
    pixInstructions: text(formData, "pixInstructions"),
    monthly: text(formData, "monthly"),
  };
  const parsed = settingsSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const input = parsed.data;
  if (input.pixKey && !input.pixHolder) {
    return { status: "error", fieldErrors: { pixHolder: "Informe o favorecido do PIX." }, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("association_save_settings", {
    p_pix_key: input.pixKey,
    p_pix_holder: input.pixHolder,
    p_pix_instructions: input.pixInstructions,
    p_monthly_cents: input.monthly,
  });
  if (error) return { status: "error", message: friendly(error), values };
  revalidateAssociation();
  return { status: "success", message: "Configuração salva." };
}

export async function addDocument(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.associationManage);
  const values = {
    kind: text(formData, "kind"),
    title: text(formData, "title"),
    description: text(formData, "description"),
    docDate: text(formData, "docDate"),
  };
  const parsed = documentSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  const file = formData.get("file");
  if (!(file instanceof File)) return { status: "error", fieldErrors: { file: "Escolha um arquivo PDF." }, values };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const problem = checkPdf(bytes);
  if (problem) return { status: "error", fieldErrors: { file: problem }, values };

  const path = `docs/${randomUUID()}.pdf`;
  const storage = createAdminClient().storage.from(ASSOCIATION_BUCKET);
  const upload = await storage.upload(path, bytes, { contentType: "application/pdf" });
  if (upload.error) return { status: "error", message: "Não foi possível guardar o arquivo. Tente de novo.", values };

  const supabase = await createClient();
  const { error } = await supabase.rpc("association_add_document", {
    p_kind: parsed.data.kind,
    p_title: parsed.data.title,
    p_description: parsed.data.description,
    p_doc_date: parsed.data.docDate,
    p_path: path,
    p_size_bytes: bytes.byteLength,
  });
  if (error) {
    await storage.remove([path]); // não deixa arquivo órfão
    return { status: "error", message: friendly(error), values };
  }
  revalidateAssociation();
  return { status: "success", message: "Documento publicado." };
}

export async function removeDocument(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.associationManage);
  const parsed = removeDocumentSchema.safeParse({ documentId: text(formData, "documentId") });
  if (!parsed.success) return { status: "error", message: "Documento inválido." };
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc("association_remove_document", { p_id: parsed.data.documentId });
  if (error) return { status: "error", message: friendly(error) };
  if (typeof path === "string") await createAdminClient().storage.from(ASSOCIATION_BUCKET).remove([path]);
  revalidateAssociation();
  return { status: "success", message: "Documento removido." };
}

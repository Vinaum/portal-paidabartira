"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/form";
import { PERMISSIONS } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { deleteAccountSchema, resolveRequestSchema, setRoleSchema, updateMemberSchema } from "./schemas";

const BUCKET = "member-media";
// ~100 anos: o Auth só aceita duração, não "para sempre".
const BAN_DURATION = "876000h";

function errorMessage(code: string | undefined): string {
  if (code === "42501") return "Você não tem permissão para esta ação.";
  if (code === "23514") return "Esta ação não é possível na situação atual.";
  if (code === "P0002") return "Registro não encontrado.";
  return "Não foi possível concluir. Recarregue a página e tente de novo.";
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

/**
 * Altera categoria, fundador e situação. A regra e o histórico são do banco
 * (`admin_update_member`). Quando a situação muda, o login também é bloqueado
 * ou liberado no Auth: é uma das operações que usam a chave secreta.
 */
export async function updateMember(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.membersManage);

  const parsed = updateMemberSchema.safeParse({
    memberId: text(formData, "memberId"),
    category: text(formData, "category"),
    isFounder: formData.get("isFounder") === "on",
    status: text(formData, "status"),
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const input = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_member", {
    p_member_id: input.memberId,
    p_category: input.category,
    p_is_founder: input.isFounder,
    p_status: input.status,
    p_reason: input.reason,
  });
  if (error) return { status: "error", message: errorMessage(error.code) };

  // A situação já vale no banco (é ele quem barra o acesso a cada requisição).
  // O bloqueio no Auth impede novo login e renovação de sessão.
  const { error: banError } = await createAdminClient().auth.admin.updateUserById(input.memberId, {
    ban_duration: input.status === "active" ? "none" : BAN_DURATION,
  });

  revalidatePath("/admin/integrantes", "layout");
  revalidatePath("/diretorio", "layout");
  if (banError) {
    return {
      status: "success",
      message:
        "Alterações salvas e já valendo no portal, mas o bloqueio de login no Auth não pôde ser sincronizado. Salve de novo para tentar outra vez.",
    };
  }
  return { status: "success", message: "Alterações salvas." };
}

export async function setMemberRole(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.membersManage);

  const parsed = setRoleSchema.safeParse({
    memberId: text(formData, "memberId"),
    role: text(formData, "role"),
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_member_role", {
    p_member_id: parsed.data.memberId,
    p_role: parsed.data.role,
    p_reason: parsed.data.reason,
  });
  if (error) return { status: "error", message: errorMessage(error.code) };

  revalidatePath("/admin/integrantes", "layout");
  return { status: "success", message: "Papel atualizado." };
}

export async function resolveDataRequest(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.privacyHandle);

  const parsed = resolveRequestSchema.safeParse({
    requestId: text(formData, "requestId"),
    status: text(formData, "status"),
    resolution: text(formData, "resolution"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_resolve_data_request", {
    p_request_id: parsed.data.requestId,
    p_status: parsed.data.status,
    p_resolution: parsed.data.resolution,
  });
  if (error) return { status: "error", message: errorMessage(error.code) };

  revalidatePath("/admin/privacidade");
  return { status: "success", message: "Pedido atualizado." };
}

/** Apaga todos os arquivos de uma pasta do bucket, descendo nas subpastas. */
async function removeFolder(prefix: string): Promise<boolean> {
  const storage = createAdminClient().storage.from(BUCKET);
  const { data, error } = await storage.list(prefix, { limit: 1000 });
  if (error) return false;
  const files: string[] = [];
  for (const item of data ?? []) {
    if (item.id) files.push(`${prefix}/${item.name}`);
    else if (!(await removeFolder(`${prefix}/${item.name}`))) return false;
  }
  if (files.length === 0) return true;
  const { error: removeError } = await storage.remove(files);
  return !removeError;
}

/**
 * Executa um pedido de exclusão de conta. Irreversível.
 *
 * Passos: (1) o banco valida o pedido e limpa a solicitação de acesso (nome,
 * e-mail, telefone); (2) apagam-se os arquivos do integrante; (3) apaga-se o
 * usuário no Auth, o que leva junto o integrante e tudo que depende dele;
 * (4) o banco confere e registra a conclusão. Se algo falha no meio, o pedido
 * continua "em análise" e pode ser executado de novo.
 */
export async function executeAccountDeletion(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.privacyHandle);

  const parsed = deleteAccountSchema.safeParse({
    requestId: text(formData, "requestId"),
    confirmation: text(formData, "confirmation").trim(),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createClient();
  const { data: memberId, error } = await supabase.rpc("admin_begin_account_deletion", {
    p_request_id: parsed.data.requestId,
  });
  if (error || typeof memberId !== "string") {
    return { status: "error", message: errorMessage(error?.code) };
  }

  if (!(await removeFolder(memberId))) {
    return {
      status: "error",
      message: "Não foi possível apagar os arquivos da pessoa. Nada mais foi apagado; tente de novo.",
    };
  }
  const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(memberId);
  if (deleteError) {
    return { status: "error", message: "Não foi possível apagar a conta no Auth. O pedido segue em análise; tente de novo." };
  }

  const { error: finishError } = await supabase.rpc("admin_finish_account_deletion", { p_member_id: memberId });
  revalidatePath("/admin", "layout");
  revalidatePath("/diretorio", "layout");
  // O pedido some junto com a conta, então a confirmação vai pela URL.
  redirect(`/admin/privacidade?concluido=${finishError ? "sem-registro" : "exclusao"}`);
}

"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/form";
import { PERMISSIONS } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { getAccessRequest, listInvitations } from "./queries";
import {
  POLICY_VERSION,
  accessRequestSchema,
  invitationSchema,
  reviewRequestSchema,
} from "./schemas";

const RECEIVED: FormState = {
  status: "success",
  message:
    "Recebemos sua solicitação. A administração da república vai analisar e responder pelo e-mail informado.",
};

/** Formulário público. Não revela se já havia solicitação para o e-mail. */
export async function submitAccessRequest(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // Campo-isca: pessoas não o veem; robôs costumam preencher. Finge sucesso.
  if (String(formData.get("website") ?? "") !== "") return RECEIVED;

  const text = (name: string) => String(formData.get(name) ?? "");
  const values = {
    fullName: text("fullName"),
    nickname: text("nickname"),
    email: text("email"),
    phone: text("phone"),
    relationship: text("relationship"),
    justification: text("justification"),
    extraInfo: text("extraInfo"),
  };
  const parsed = accessRequestSchema.safeParse({ ...values, consent: formData.get("consent") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_membership_request", {
    p_full_name: parsed.data.fullName,
    p_email: parsed.data.email,
    p_relationship: parsed.data.relationship,
    p_justification: parsed.data.justification,
    p_policy_version: POLICY_VERSION,
    p_nickname: parsed.data.nickname,
    p_phone: parsed.data.phone,
    p_extra_info: parsed.data.extraInfo,
  });
  if (error) {
    return {
      status: "error",
      message: "Não foi possível enviar agora. Confira os dados e tente de novo em alguns minutos.",
      values,
    };
  }
  if (data === "throttled") {
    return {
      status: "error",
      message: "Recebemos muitas solicitações na última hora. Tente novamente mais tarde.",
      values,
    };
  }
  return RECEIVED;
}

/** Aprovar, rejeitar, pedir informações ou reabrir. A regra final é do banco. */
export async function reviewRequest(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.requestsReview);

  const parsed = reviewRequestSchema.safeParse({
    action: formData.get("action"),
    requestId: formData.get("requestId"),
    category: formData.get("category") || undefined,
    isFounder: formData.get("isFounder") === "on",
    role: formData.get("role") || "membro",
    adminNotes: formData.get("adminNotes") ?? "",
    infoRequest: formData.get("infoRequest") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const input = parsed.data;

  if (input.action === "approve" && input.isFounder && input.category !== "ex_morador") {
    return {
      status: "error",
      fieldErrors: { isFounder: "O atributo fundador só vale para ex-moradores." },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_request", {
    p_request_id: input.requestId,
    p_action: input.action,
    p_category: input.action === "approve" ? input.category : null,
    p_is_founder: input.action === "approve" ? input.isFounder : false,
    p_role: input.action === "approve" ? input.role : "membro",
    p_admin_notes: input.adminNotes,
    p_info_request: input.action === "request_info" ? input.infoRequest : null,
  });
  if (error) {
    return { status: "error", message: reviewErrorMessage(error.code) };
  }

  revalidatePath("/admin/solicitacoes", "layout");
  const done: Record<typeof input.action, string> = {
    approve: "Solicitação aprovada. Agora envie o convite.",
    reject: "Solicitação rejeitada.",
    request_info: "Pedido de informações registrado.",
    reopen: "Solicitação reaberta para análise.",
  };
  return { status: "success", message: done[input.action] };
}

function reviewErrorMessage(code: string | undefined): string {
  if (code === "42501") return "Você não tem permissão para esta ação ou para conceder este papel.";
  if (code === "23514") return "A solicitação não está em um estado que permita esta ação.";
  return "Não foi possível concluir. Recarregue a página e tente de novo.";
}

/**
 * Cria o usuário convidado no Supabase Auth e registra o convite.
 *
 * É uma das três operações que usam a chave secreta (ver lib/supabase/admin.ts):
 * a permissão do administrador é conferida antes, e o registro em auditoria
 * é feito por `admin_register_invitation`.
 *
 * Modos:
 *   email -> o Supabase envia o e-mail de convite (exige SMTP configurado);
 *   link  -> nenhum e-mail é enviado; o administrador recebe o link uma única
 *            vez e o repassa ao convidado por um canal de confiança.
 */
export async function createInvitation(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.requestsReview);

  const parsed = invitationSchema.safeParse({
    requestId: formData.get("requestId"),
    mode: formData.get("mode"),
  });
  if (!parsed.success) return { status: "error", message: "Pedido inválido." };
  const { requestId, mode } = parsed.data;

  const request = await getAccessRequest(requestId);
  if (!request || (request.status !== "approved" && request.status !== "invited")) {
    return { status: "error", message: "A solicitação precisa estar aprovada para receber convite." };
  }

  const admin = createAdminClient();

  // Reenvio: convites ainda não aceitos são descartados junto com o usuário
  // pendente no Auth (um convite não aceito nunca tem integrante associado).
  const pending = (await listInvitations(requestId)).filter((invitation) => !invitation.accepted_at);
  for (const invitation of pending) {
    const { error } = await admin.auth.admin.deleteUser(invitation.auth_user_id);
    if (error) {
      return { status: "error", message: "Não foi possível substituir o convite anterior." };
    }
  }

  let userId: string;
  let invitePath: string | null = null;

  if (mode === "email") {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(request.email);
    if (error || !data.user) {
      return {
        status: "error",
        message:
          "O Supabase não enviou o e-mail. Sem SMTP próprio, ele só envia para endereços da equipe do projeto. Use \"Gerar link de convite\".",
      };
    }
    userId = data.user.id;
  } else {
    const { data, error } = await admin.auth.admin.generateLink({ type: "invite", email: request.email });
    if (error || !data.user || !data.properties?.hashed_token) {
      return { status: "error", message: "Não foi possível gerar o link de convite." };
    }
    userId = data.user.id;
    invitePath = `/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=invite`;
  }

  const supabase = await createClient();
  const { error: registerError } = await supabase.rpc("admin_register_invitation", {
    p_request_id: requestId,
    p_auth_user_id: userId,
  });
  if (registerError) {
    // Sem registro não há convite válido: desfaz o usuário recém-criado.
    await admin.auth.admin.deleteUser(userId);
    return { status: "error", message: "Não foi possível registrar o convite. Nada foi enviado." };
  }

  revalidatePath("/admin/solicitacoes", "layout");
  return invitePath
    ? {
        status: "success",
        message: "Link gerado. Ele aparece só agora: copie e envie ao convidado.",
        data: { invitePath },
      }
    : { status: "success", message: `Convite enviado para ${request.email}.` };
}

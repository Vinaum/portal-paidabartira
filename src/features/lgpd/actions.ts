"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireActiveMember } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/form";
import { createClient } from "@/lib/supabase/server";

const deletionSchema = z.object({
  details: z
    .string()
    .trim()
    .max(1000, "Use até 1000 caracteres.")
    .transform((value) => (value === "" ? null : value)),
  confirm: z.literal("on", { error: "Confirme para enviar o pedido." }),
});

/**
 * Pedido de exclusão de conta (LGPD). Não apaga nada na hora: abre uma
 * solicitação que o responsável pela privacidade analisa e registra.
 */
export async function requestDeletion(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const values = { details: String(formData.get("details") ?? "") };
  const parsed = deletionSchema.safeParse({ ...values, confirm: formData.get("confirm") ?? "" });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase
    .from("data_requests")
    .insert({ member_id: member.id, kind: "deletion", details: parsed.data.details });

  if (error?.code === "23505") {
    return { status: "error", message: "Você já tem um pedido de exclusão em andamento.", values };
  }
  if (error) return { status: "error", message: "Não foi possível enviar o pedido. Tente de novo.", values };

  revalidatePath("/perfil");
  return { status: "success", message: "Pedido enviado. Você será avisado quando for analisado." };
}

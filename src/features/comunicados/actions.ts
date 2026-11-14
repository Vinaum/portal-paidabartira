"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/form";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

import { announcementSchema, deleteSchema } from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function revalidateAnnouncements() {
  revalidatePath("/comunicados", "layout");
  revalidatePath("/painel");
  revalidatePath("/admin/comunicados", "layout");
}

export async function saveAnnouncement(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requirePermission(PERMISSIONS.announcementsPublish);
  const values = {
    announcementId: text(formData, "announcementId"),
    title: text(formData, "title"),
    body: text(formData, "body"),
    visibility: text(formData, "visibility"),
    expiresOn: text(formData, "expiresOn"),
  };
  const parsed = announcementSchema.safeParse({ ...values, isPinned: formData.get("isPinned") === "on" });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const input = parsed.data;
  const fields = {
    title: input.title,
    body: input.body,
    visibility: input.visibility,
    is_pinned: input.isPinned,
    expires_on: input.expiresOn,
  };

  const supabase = await createClient();
  if (input.announcementId) {
    const { data, error } = await supabase.from("announcements").update(fields).eq("id", input.announcementId).select("id");
    if (error || !data?.length) return { status: "error", message: "Não foi possível salvar o comunicado.", values };
    revalidateAnnouncements();
    return { status: "success", message: "Comunicado salvo." };
  }
  const { error } = await supabase.from("announcements").insert({ ...fields, created_by: member.id });
  if (error) return { status: "error", message: "Não foi possível publicar o comunicado.", values };
  revalidateAnnouncements();
  redirect("/admin/comunicados?publicado=1");
}

export async function deleteAnnouncement(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.announcementsPublish);
  const parsed = deleteSchema.safeParse({ announcementId: text(formData, "announcementId") });
  if (!parsed.success) return { status: "error", message: "Comunicado inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", parsed.data.announcementId);
  if (error) return { status: "error", message: "Não foi possível apagar o comunicado." };
  revalidateAnnouncements();
  redirect("/admin/comunicados?apagado=1");
}

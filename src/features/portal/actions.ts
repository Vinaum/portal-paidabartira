"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/form";
import { reencodeToWebp } from "@/lib/images";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

const contentSchema = z.object({
  history: z
    .string()
    .trim()
    .max(8000, "Use até 8000 caracteres.")
    .transform((value) => (value === "" ? null : value)),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "E-mail muito longo.")
    .transform((value) => (value === "" ? null : value))
    .pipe(z.email("Informe um e-mail válido.").nullable()),
});

function revalidatePublic() {
  revalidatePath("/", "layout");
}

export async function saveSiteContent(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requirePermission(PERMISSIONS.settingsManage);
  const values = { history: text(formData, "history"), contactEmail: text(formData, "contactEmail") };
  const parsed = contentSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  const supabase = await createClient();
  const rows = [
    { key: "republic.history", value: parsed.data.history },
    { key: "republic.contact_email", value: parsed.data.contactEmail },
  ].map((row) => ({ ...row, is_public: true, updated_by: member.id }));
  const { error } = await supabase.from("republic_settings").upsert(rows, { onConflict: "key" });
  if (error) return { status: "error", message: "Não foi possível salvar.", values };
  revalidatePublic();
  return { status: "success", message: "Conteúdo salvo." };
}

/** Foto da casa: regrava em WebP (sem metadados) no bucket público e atualiza a configuração. */
export async function saveHousePhoto(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requirePermission(PERMISSIONS.settingsManage);
  const image = await reencodeToWebp(formData.get("photo"), 1600);
  if (!image.ok) return { status: "error", message: image.message };

  const supabase = await createClient();
  const { data: current } = await supabase.from("republic_settings").select("value").eq("key", "republic.house_photo").maybeSingle();
  const previous = typeof current?.value === "string" ? current.value : null;

  const path = `site/house-${crypto.randomUUID()}.webp`;
  const storage = supabase.storage.from("public-media");
  const upload = await storage.upload(path, image.data, { contentType: "image/webp" });
  if (upload.error) return { status: "error", message: "Não foi possível enviar a foto." };
  const { error } = await supabase
    .from("republic_settings")
    .upsert({ key: "republic.house_photo", value: path, is_public: true, updated_by: member.id }, { onConflict: "key" });
  if (error) {
    await storage.remove([path]);
    return { status: "error", message: "Não foi possível salvar a foto." };
  }
  if (previous) await storage.remove([previous]);
  revalidatePublic();
  return { status: "success", message: "Foto da casa atualizada." };
}

export async function removeHousePhoto(): Promise<FormState> {
  const member = await requirePermission(PERMISSIONS.settingsManage);
  const supabase = await createClient();
  const { data: current } = await supabase.from("republic_settings").select("value").eq("key", "republic.house_photo").maybeSingle();
  const previous = typeof current?.value === "string" ? current.value : null;
  const { error } = await supabase
    .from("republic_settings")
    .upsert({ key: "republic.house_photo", value: null, is_public: true, updated_by: member.id }, { onConflict: "key" });
  if (error) return { status: "error", message: "Não foi possível remover." };
  if (previous) await supabase.storage.from("public-media").remove([previous]);
  revalidatePublic();
  return { status: "success", message: "Foto removida." };
}

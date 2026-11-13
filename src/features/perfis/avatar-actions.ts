"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { requireActiveMember } from "@/lib/auth/session";
import type { FormState } from "@/lib/form";
import { createClient } from "@/lib/supabase/server";

/**
 * Foto de perfil. O arquivo recebido nunca é guardado como veio: o sharp o
 * decodifica (recusa o que não for imagem de verdade), corrige a orientação,
 * recorta em quadrado de 512 px e regrava em WebP, o que descarta metadados
 * como a localização GPS da câmera.
 */

const BUCKET = "member-media";
// A Vercel limita o corpo da requisição a 4,5 MB.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_INPUT_PIXELS = 50_000_000;
const FAILED: FormState = { status: "error", message: "Não foi possível salvar a foto. Tente de novo." };

export async function saveAvatar(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Escolha uma imagem." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { status: "error", message: "A imagem passa de 4 MB. Escolha uma menor." };
  }

  let image: Buffer;
  try {
    image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { status: "error", message: "Não foi possível ler esta imagem. Use JPEG, PNG ou WebP." };
  }

  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("profile_photo")
    .select("media_path")
    .eq("member_id", member.id)
    .maybeSingle();

  const path = `${member.id}/avatar/${crypto.randomUUID()}.webp`;
  const upload = await supabase.storage.from(BUCKET).upload(path, image, { contentType: "image/webp" });
  if (upload.error) return FAILED;

  const { error } = await supabase
    .from("profile_photo")
    .upsert({ member_id: member.id, media_path: path, updated_at: new Date().toISOString() }, { onConflict: "member_id" });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return FAILED;
  }
  if (previous?.media_path) await supabase.storage.from(BUCKET).remove([previous.media_path]);

  revalidatePath("/perfil");
  revalidatePath("/diretorio", "layout");
  return { status: "success", message: "Foto atualizada." };
}

export async function removeAvatar(): Promise<FormState> {
  const member = await requireActiveMember();
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("profile_photo")
    .select("media_path")
    .eq("member_id", member.id)
    .maybeSingle();
  if (!current) return { status: "success", message: "Você não tem foto." };

  const { error } = await supabase.from("profile_photo").delete().eq("member_id", member.id);
  if (error) return FAILED;
  await supabase.storage.from(BUCKET).remove([current.media_path]);

  revalidatePath("/perfil");
  revalidatePath("/diretorio", "layout");
  return { status: "success", message: "Foto removida." };
}

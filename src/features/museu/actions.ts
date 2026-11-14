"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActiveMember, requirePermission } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/form";
import { reencodeToWebp } from "@/lib/images";
import { PERMISSIONS } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { MUSEUM_BUCKET } from "./queries";
import { albumSchema, hideSchema, idSchema, photoSchema, removePhotoSchema } from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function revalidateMuseum(albumId?: string) {
  revalidatePath("/museu");
  revalidatePath("/");
  if (albumId) {
    revalidatePath(`/museu/${albumId}`);
    revalidatePath(`/museu/${albumId}/editar`);
  }
}

export async function saveAlbum(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const values = {
    albumId: text(formData, "albumId"),
    title: text(formData, "title"),
    description: text(formData, "description"),
    year: text(formData, "year"),
    visibility: text(formData, "visibility"),
  };
  const parsed = albumSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const input = parsed.data;

  const supabase = await createClient();
  if (input.albumId) {
    // A RLS só deixa quem criou o álbum alterá-lo.
    const { data, error } = await supabase
      .from("albums")
      .update({ title: input.title, description: input.description, year: input.year, visibility: input.visibility })
      .eq("id", input.albumId)
      .select("id");
    if (error || !data?.length) return { status: "error", message: "Não foi possível salvar o álbum.", values };
    revalidateMuseum(input.albumId);
    return { status: "success", message: "Álbum salvo." };
  }
  const { data, error } = await supabase
    .from("albums")
    .insert({
      title: input.title,
      description: input.description,
      year: input.year,
      visibility: input.visibility,
      created_by: member.id,
    })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: "Não foi possível criar o álbum.", values };
  revalidateMuseum();
  redirect(`/museu/${data.id}?criado=1`);
}

/** Apaga as fotos do storage (de todas as pessoas) e depois o álbum. */
export async function deleteAlbum(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActiveMember();
  const parsed = idSchema.safeParse({ id: text(formData, "id") });
  if (!parsed.success) return { status: "error", message: "Álbum inválido." };
  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, album_photos(path)").eq("id", parsed.data.id).maybeSingle();
  if (!album) return { status: "error", message: "Álbum não encontrado." };
  const { data: deleted, error } = await supabase.from("albums").delete().eq("id", parsed.data.id).select("id");
  if (error || !deleted?.length) return { status: "error", message: "Só quem criou o álbum pode apagá-lo." };
  const paths = (album.album_photos as { path: string }[]).map((photo) => photo.path);
  if (paths.length > 0) await createAdminClient().storage.from(MUSEUM_BUCKET).remove(paths);
  revalidateMuseum();
  redirect("/museu?apagado=1");
}

export async function addAlbumPhoto(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const parsed = photoSchema.safeParse({ albumId: text(formData, "albumId"), caption: text(formData, "caption") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const { albumId, caption } = parsed.data;

  const supabase = await createClient();
  const { data: album } = await supabase.from("albums").select("id, is_hidden").eq("id", albumId).maybeSingle();
  if (!album || album.is_hidden) return { status: "error", message: "Álbum indisponível." };

  const image = await reencodeToWebp(formData.get("photo"), 1920);
  if (!image.ok) return { status: "error", message: image.message };

  // Caminho começa pela pessoa: a exclusão de conta apaga a pasta inteira.
  const path = `${member.id}/${albumId}/${crypto.randomUUID()}.webp`;
  const storage = createAdminClient().storage.from(MUSEUM_BUCKET);
  const upload = await storage.upload(path, image.data, { contentType: "image/webp" });
  if (upload.error) return { status: "error", message: "Não foi possível salvar a foto. Tente de novo." };
  const { error } = await supabase
    .from("album_photos")
    .insert({ album_id: albumId, uploaded_by: member.id, path, caption });
  if (error) {
    await storage.remove([path]);
    return { status: "error", message: "Não foi possível adicionar a foto. O álbum pode estar cheio (100 fotos)." };
  }
  revalidateMuseum(albumId);
  return { status: "success", message: "Foto adicionada." };
}

export async function removeAlbumPhoto(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActiveMember();
  const parsed = removePhotoSchema.safeParse({ albumId: text(formData, "albumId"), photoId: text(formData, "photoId") });
  if (!parsed.success) return { status: "error", message: "Foto inválida." };
  const supabase = await createClient();
  const { data: photo } = await supabase.from("album_photos").select("path").eq("id", parsed.data.photoId).maybeSingle();
  if (!photo) return { status: "error", message: "Foto não encontrada." };
  const { data, error } = await supabase.from("album_photos").delete().eq("id", parsed.data.photoId).select("id");
  if (error || !data?.length) return { status: "error", message: "Só quem enviou a foto ou criou o álbum pode removê-la." };
  await createAdminClient().storage.from(MUSEUM_BUCKET).remove([photo.path]);
  revalidateMuseum(parsed.data.albumId);
  return { status: "success", message: "Foto removida." };
}

export async function setMuseumHidden(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.storiesModerate);
  const parsed = hideSchema.safeParse({
    kind: text(formData, "kind"),
    id: text(formData, "id"),
    albumId: text(formData, "albumId"),
    hidden: formData.get("hidden") === "1",
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("museum_set_hidden", {
    p_kind: parsed.data.kind,
    p_id: parsed.data.id,
    p_hidden: parsed.data.hidden,
    p_reason: parsed.data.reason ?? "",
  });
  if (error) return { status: "error", message: "Não foi possível alterar o item." };
  revalidateMuseum(parsed.data.albumId);
  return { status: "success", message: parsed.data.hidden ? "Item ocultado." : "Item reexibido." };
}

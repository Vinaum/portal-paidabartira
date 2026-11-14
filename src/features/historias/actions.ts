"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActiveMember, requirePermission } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/form";
import { reencodeToWebp } from "@/lib/images";
import { PERMISSIONS } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { STORY_BUCKET } from "./queries";
import { commentSchema, hideSchema, idSchema, photoIdSchema, storySchema } from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function revalidateStories(storyId?: string) {
  revalidatePath("/historias");
  if (storyId) {
    revalidatePath(`/historias/${storyId}`);
    revalidatePath(`/historias/${storyId}/editar`);
  }
}

export async function saveStory(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const values = {
    storyId: text(formData, "storyId"),
    title: text(formData, "title"),
    body: text(formData, "body"),
    era: text(formData, "era"),
  };
  const parsed = storySchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const input = parsed.data;

  const supabase = await createClient();
  if (input.storyId) {
    // A RLS só deixa o autor alterar a própria história.
    const { data, error } = await supabase
      .from("stories")
      .update({ title: input.title, body: input.body, era: input.era })
      .eq("id", input.storyId)
      .select("id");
    if (error || !data?.length) return { status: "error", message: "Não foi possível salvar a história.", values };
    revalidateStories(input.storyId);
    return { status: "success", message: "História salva." };
  }
  const { data, error } = await supabase
    .from("stories")
    .insert({ author_id: member.id, title: input.title, body: input.body, era: input.era })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: "Não foi possível publicar a história.", values };
  revalidateStories();
  redirect(`/historias/${data.id}/editar?criada=1`);
}

/** Apaga as fotos do storage e depois a história (comentários e registros de fotos vão junto). */
export async function deleteStory(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActiveMember();
  const parsed = idSchema.safeParse({ id: text(formData, "id") });
  if (!parsed.success) return { status: "error", message: "História inválida." };

  const supabase = await createClient();
  const { data: story } = await supabase.from("stories").select("id, story_photos(path)").eq("id", parsed.data.id).maybeSingle();
  if (!story) return { status: "error", message: "História não encontrada." };
  const { data: deleted, error } = await supabase.from("stories").delete().eq("id", parsed.data.id).select("id");
  if (error || !deleted?.length) return { status: "error", message: "Só a autora ou o autor pode apagar a história." };
  const paths = (story.story_photos as { path: string }[]).map((photo) => photo.path);
  if (paths.length > 0) await createAdminClient().storage.from(STORY_BUCKET).remove(paths);
  revalidateStories();
  redirect("/historias?apagada=1");
}

export async function addStoryPhoto(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const storyId = text(formData, "storyId");
  if (!idSchema.safeParse({ id: storyId }).success) return { status: "error", message: "História inválida." };

  const supabase = await createClient();
  const { data: story } = await supabase
    .from("stories")
    .select("id, author_id, story_photos(position)")
    .eq("id", storyId)
    .maybeSingle();
  if (!story || story.author_id !== member.id) return { status: "error", message: "Só quem escreveu pode anexar fotos." };
  const used = new Set((story.story_photos as { position: number }[]).map((photo) => photo.position));
  const position = [0, 1, 2, 3].find((slot) => !used.has(slot));
  if (position === undefined) return { status: "error", message: "Cada história aceita até 4 fotos." };

  const image = await reencodeToWebp(formData.get("photo"), 1600);
  if (!image.ok) return { status: "error", message: image.message };

  // Caminho começa pela pessoa: a exclusão de conta apaga a pasta inteira.
  const path = `${member.id}/${storyId}/${crypto.randomUUID()}.webp`;
  const storage = createAdminClient().storage.from(STORY_BUCKET);
  const upload = await storage.upload(path, image.data, { contentType: "image/webp" });
  if (upload.error) return { status: "error", message: "Não foi possível salvar a foto. Tente de novo." };
  const { error } = await supabase.from("story_photos").insert({ story_id: storyId, path, position });
  if (error) {
    await storage.remove([path]);
    return { status: "error", message: "Não foi possível anexar a foto. Tente de novo." };
  }
  revalidateStories(storyId);
  return { status: "success", message: "Foto anexada." };
}

export async function removeStoryPhoto(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActiveMember();
  const parsed = photoIdSchema.safeParse({ storyId: text(formData, "storyId"), photoId: text(formData, "photoId") });
  if (!parsed.success) return { status: "error", message: "Foto inválida." };
  const supabase = await createClient();
  const { data: photo } = await supabase.from("story_photos").select("path").eq("id", parsed.data.photoId).maybeSingle();
  if (!photo) return { status: "error", message: "Foto não encontrada." };
  const { data, error } = await supabase.from("story_photos").delete().eq("id", parsed.data.photoId).select("id");
  if (error || !data?.length) return { status: "error", message: "Só quem escreveu pode remover fotos." };
  await createAdminClient().storage.from(STORY_BUCKET).remove([photo.path]);
  revalidateStories(parsed.data.storyId);
  return { status: "success", message: "Foto removida." };
}

export async function addComment(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const values = { storyId: text(formData, "storyId"), body: text(formData, "body") };
  const parsed = commentSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const supabase = await createClient();
  const { error } = await supabase
    .from("story_comments")
    .insert({ story_id: parsed.data.storyId, author_id: member.id, body: parsed.data.body });
  if (error) return { status: "error", message: "Não foi possível comentar. A história pode ter sido ocultada.", values };
  revalidateStories(parsed.data.storyId);
  return { status: "success", message: "Comentário publicado." };
}

export async function deleteComment(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireActiveMember();
  const parsed = idSchema.safeParse({ id: text(formData, "id") });
  if (!parsed.success) return { status: "error", message: "Comentário inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("story_comments").delete().eq("id", parsed.data.id).select("id, story_id");
  if (error || !data?.length) return { status: "error", message: "Não foi possível apagar o comentário." };
  revalidateStories(data[0]?.story_id);
  return { status: "success", message: "Comentário apagado." };
}

export async function setStoryHidden(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.storiesModerate);
  const parsed = hideSchema.safeParse({
    storyId: text(formData, "storyId"),
    hidden: formData.get("hidden") === "1",
    reason: text(formData, "reason"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.rpc("story_set_hidden", {
    p_story_id: parsed.data.storyId,
    p_hidden: parsed.data.hidden,
    p_reason: parsed.data.reason ?? "",
  });
  if (error) return { status: "error", message: "Não foi possível alterar a história." };
  revalidateStories(parsed.data.storyId);
  return { status: "success", message: parsed.data.hidden ? "História ocultada." : "História reexibida." };
}

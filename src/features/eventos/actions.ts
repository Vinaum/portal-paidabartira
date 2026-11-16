"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireActiveMember, requirePermission } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/form";
import { PERMISSIONS } from "@/lib/permissions";
import { reencodeToWebp } from "@/lib/images";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { EVENT_BUCKET, FLYER_MAX_SIDE, flyerStoragePath } from "./flyer";
import { eventIdSchema, eventSchema, rsvpSchema } from "./schemas";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

function revalidateEvents() {
  revalidatePath("/agenda", "layout");
  revalidatePath("/admin/eventos", "layout");
  revalidatePath("/eventos");
  revalidatePath("/painel");
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Grava, troca ou remove o flyer. A função do banco confere a permissão e o
 * formato do caminho e devolve o arquivo anterior, que é apagado depois de a
 * troca valer (se a gravação falhar, o flyer velho continua no lugar).
 */
async function applyFlyer(
  supabase: SupabaseClient,
  eventId: string,
  change: { image: Buffer } | { remove: true },
): Promise<boolean> {
  const storage = createAdminClient().storage.from(EVENT_BUCKET);
  let path: string | null = null;
  if ("image" in change) {
    path = flyerStoragePath(eventId);
    const upload = await storage.upload(path, change.image, { contentType: "image/webp" });
    if (upload.error) return false;
  }
  const { data: previous, error } = await supabase.rpc("set_event_flyer", { p_event_id: eventId, p_path: path });
  if (error) {
    if (path) await storage.remove([path]);
    return false;
  }
  if (typeof previous === "string" && previous) await storage.remove([previous]);
  return true;
}

/** Cria ou edita um evento. A RLS exige `events.manage`; a permissão é conferida aqui também. */
export async function saveEvent(_previous: FormState, formData: FormData): Promise<FormState> {
  const manager = await requirePermission(PERMISSIONS.eventsManage);

  const values = {
    eventId: text(formData, "eventId"),
    title: text(formData, "title"),
    description: text(formData, "description"),
    location: text(formData, "location"),
    startsAt: text(formData, "startsAt"),
    endsAt: text(formData, "endsAt"),
    visibility: text(formData, "visibility"),
    status: text(formData, "status"),
  };
  const parsed = eventSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const input = parsed.data;

  // O flyer é conferido antes de gravar o evento, para um arquivo ruim não deixar o evento pela metade.
  const file = formData.get("flyer");
  let flyerImage: Buffer | null = null;
  if (file instanceof File && file.size > 0) {
    const image = await reencodeToWebp(file, FLYER_MAX_SIDE);
    if (!image.ok) return { status: "error", fieldErrors: { flyer: image.message }, values };
    flyerImage = image.data;
  }
  const removeFlyer = flyerImage === null && formData.get("removeFlyer") === "on";
  const flyerChange = flyerImage ? { image: flyerImage } : removeFlyer ? { remove: true as const } : null;

  const supabase = await createClient();
  const fields = {
    title: input.title,
    description: input.description,
    location: input.location,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    visibility: input.visibility,
    status: input.status,
  };

  if (input.eventId) {
    const { data, error } = await supabase.from("events").update(fields).eq("id", input.eventId).select("id");
    if (error || !data?.length) {
      return { status: "error", message: "Não foi possível salvar o evento.", values };
    }
    const flyerOk = flyerChange ? await applyFlyer(supabase, input.eventId, flyerChange) : true;
    revalidateEvents();
    if (!flyerOk) {
      return { status: "error", message: "O evento foi salvo, mas o flyer não. Tente enviar a imagem de novo.", values };
    }
    return { status: "success", message: "Evento salvo." };
  }

  const { data, error } = await supabase
    .from("events")
    .insert({ ...fields, created_by: manager.id })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: "Não foi possível criar o evento.", values };
  const flyerOk = flyerChange ? await applyFlyer(supabase, data.id, flyerChange) : true;
  revalidateEvents();
  redirect(`/admin/eventos/${data.id}?criado=1${flyerOk ? "" : "&flyer=erro"}`);
}

/** Só rascunho se apaga (a RLS garante); evento publicado se cancela. */
export async function deleteDraftEvent(_previous: FormState, formData: FormData): Promise<FormState> {
  await requirePermission(PERMISSIONS.eventsManage);
  const parsed = eventIdSchema.safeParse({ eventId: text(formData, "eventId") });
  if (!parsed.success) return { status: "error", message: "Pedido inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", parsed.data.eventId)
    .select("id, flyer_path");
  if (error || !data?.length) {
    return { status: "error", message: "Só rascunhos podem ser apagados. Para um evento publicado, use Cancelado." };
  }
  const flyerPath = data[0]?.flyer_path;
  if (flyerPath) await createAdminClient().storage.from(EVENT_BUCKET).remove([flyerPath]);
  revalidateEvents();
  redirect("/admin/eventos?apagado=1");
}

export async function setRsvp(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const parsed = rsvpSchema.safeParse({
    eventId: text(formData, "eventId"),
    answer: text(formData, "answer"),
    guests: text(formData, "guests"),
  });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };
  const { eventId, answer, guests } = parsed.data;

  const supabase = await createClient();
  const fields = { answer, guests: answer === "going" ? guests : 0 };
  // Atualiza a resposta existente; se não houver, cria. (Não usa upsert: o
  // integrante só tem permissão de alterar resposta e acompanhantes, não a chave.)
  const updated = await supabase
    .from("event_rsvps")
    .update(fields)
    .eq("event_id", eventId)
    .eq("member_id", member.id)
    .select("event_id");
  let error = updated.error;
  if (!error && !updated.data?.length) {
    ({ error } = await supabase.from("event_rsvps").insert({ event_id: eventId, member_id: member.id, ...fields }));
  }
  if (error) {
    return {
      status: "error",
      message: "Não foi possível registrar. O evento pode ter terminado ou sido cancelado.",
    };
  }
  revalidatePath("/agenda", "layout");
  return { status: "success", message: "Resposta registrada." };
}

export async function clearRsvp(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const parsed = eventIdSchema.safeParse({ eventId: text(formData, "eventId") });
  if (!parsed.success) return { status: "error", message: "Pedido inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("event_rsvps")
    .delete()
    .eq("event_id", parsed.data.eventId)
    .eq("member_id", member.id);
  if (error) return { status: "error", message: "Não foi possível remover sua resposta." };
  revalidatePath("/agenda", "layout");
  return { status: "success", message: "Resposta removida." };
}

import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { EVENT_STATUSES, EVENT_VISIBILITIES, RSVP_ANSWERS } from "./schemas";

/**
 * Leitura de eventos. A RLS decide o que cada pessoa vê (visitante, integrante,
 * quem gerencia); os filtros aqui só refinam a tela.
 */
const eventSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  location: z.string().nullable(),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
  visibility: z.enum(EVENT_VISIBILITIES),
  status: z.enum(EVENT_STATUSES),
});
export type EventRow = z.infer<typeof eventSchema>;

const COLUMNS = "id, title, description, location, starts_at, ends_at, visibility, status";

type Scope = "upcoming" | "past";

/** Eventos para a tela. `publicOnly` mostra só os abertos a visitantes. */
export async function listEvents(options: { scope: Scope; publicOnly?: boolean; limit?: number; includeDrafts?: boolean }) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  let query = supabase.from("events").select(COLUMNS);
  if (!options.includeDrafts) query = query.in("status", ["published", "cancelled"]);
  if (options.publicOnly) query = query.eq("visibility", "public");
  // Sem hora de fim, vale o início: filtra por "termina depois de agora".
  query =
    options.scope === "upcoming"
      ? query.or(`ends_at.gte.${now},and(ends_at.is.null,starts_at.gte.${now})`).order("starts_at", { ascending: true })
      : query.or(`ends_at.lt.${now},and(ends_at.is.null,starts_at.lt.${now})`).order("starts_at", { ascending: false });
  const { data, error } = await query.limit(options.limit ?? 60);
  if (error) throw new Error(`Falha ao listar eventos: ${error.message}`);
  return z.array(eventSchema).parse(data ?? []);
}

export async function getEvent(id: string): Promise<EventRow | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao ler o evento: ${error.message}`);
  return data ? eventSchema.parse(data) : null;
}

const rsvpSchema = z.object({ answer: z.enum(RSVP_ANSWERS), guests: z.number() });

export async function getMyRsvp(eventId: string, memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_rsvps")
    .select("answer, guests")
    .eq("event_id", eventId)
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler sua resposta: ${error.message}`);
  return data ? rsvpSchema.parse(data) : null;
}

const attendeeSchema = z.object({
  member_id: z.uuid(),
  display_name: z.string(),
  answer: z.enum(RSVP_ANSWERS),
  guests: z.number(),
});
export type Attendee = z.infer<typeof attendeeSchema>;

export async function getAttendees(eventId: string): Promise<Attendee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("event_attendees", { p_event_id: eventId });
  if (error) throw new Error(`Falha ao ler as confirmações: ${error.message}`);
  return z.array(attendeeSchema).parse(data ?? []);
}

/** Total de pessoas que vão (inclui acompanhantes). */
export function countGoing(attendees: Attendee[]): number {
  return attendees.filter((a) => a.answer === "going").reduce((sum, a) => sum + 1 + a.guests, 0);
}

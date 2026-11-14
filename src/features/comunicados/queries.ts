import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { VISIBILITIES } from "./schemas";

const row = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  visibility: z.enum(VISIBILITIES),
  is_pinned: z.boolean(),
  expires_on: z.string().nullable(),
  created_at: z.string(),
});
export type Announcement = z.infer<typeof row>;

const COLUMNS = "id, title, body, visibility, is_pinned, expires_on, created_at";

/** O que a pessoa pode ler (a RLS decide: visitante só os públicos e vigentes). */
export async function listAnnouncements(limit = 50): Promise<Announcement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(COLUMNS)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Falha ao ler os comunicados: ${error.message}`);
  return z.array(row).parse(data ?? []);
}

export async function getAnnouncement(id: string): Promise<Announcement | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("announcements").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao ler o comunicado: ${error.message}`);
  return data ? row.parse(data) : null;
}

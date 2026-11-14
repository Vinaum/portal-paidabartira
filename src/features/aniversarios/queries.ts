import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import type { Birthday } from "./dates";

const row = z.object({
  member_id: z.uuid(),
  display_name: z.string(),
  birth_day: z.number(),
  birth_month: z.number(),
});

/** Aniversários que a RLS libera para quem consulta (quem preencheu e compartilha). */
export async function listBirthdays(): Promise<Birthday[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_birthdays");
  if (error) throw new Error(`Falha ao ler os aniversários: ${error.message}`);
  return z
    .array(row)
    .parse(data ?? [])
    .map((item) => ({ memberId: item.member_id, name: item.display_name, day: item.birth_day, month: item.birth_month }));
}

import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { INTEREST_STATUSES, VACANCY_STATUSES } from "./schemas";

const vacancyRow = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  monthly_cents: z.number().nullable(),
  available_from: z.string().nullable(),
  status: z.enum(VACANCY_STATUSES),
  created_at: z.string(),
});
export type Vacancy = z.infer<typeof vacancyRow>;
const COLUMNS = "id, title, description, monthly_cents, available_from, status, created_at";

/** Visitantes recebem só as abertas (RLS); quem gerencia recebe todas. */
export async function listVacancies(): Promise<Vacancy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vacancies").select(COLUMNS).order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(`Falha ao ler as vagas: ${error.message}`);
  return z.array(vacancyRow).parse(data ?? []);
}

export async function getVacancy(id: string): Promise<Vacancy | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("vacancies").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao ler a vaga: ${error.message}`);
  return data ? vacancyRow.parse(data) : null;
}

const interestRow = z.object({
  id: z.uuid(),
  vacancy_id: z.uuid(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  course: z.string().nullable(),
  message: z.string().nullable(),
  status: z.enum(INTEREST_STATUSES),
  created_at: z.string(),
});
export type VacancyInterest = z.infer<typeof interestRow>;

/** Gestão: apaga o que passou de 90 dias e devolve o restante. */
export async function listInterests(): Promise<VacancyInterest[]> {
  const supabase = await createClient();
  const purge = await supabase.rpc("vacancy_purge_old_interests");
  if (purge.error) throw new Error(`Falha ao limpar interesses antigos: ${purge.error.message}`);
  const { data, error } = await supabase
    .from("vacancy_interests")
    .select("id, vacancy_id, name, email, phone, course, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(`Falha ao ler os interesses: ${error.message}`);
  return z.array(interestRow).parse(data ?? []);
}

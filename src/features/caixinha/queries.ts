import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { FUND_VISIBILITIES } from "./schemas";

/**
 * Leituras da caixinha. Visitantes e integrantes só chegam aos números pelas
 * funções do banco (`fund_overview`, `fund_cashflow`, `fund_expenses`), que não
 * devolvem nome de quem contribuiu. Lançamentos individuais só são lidos por
 * quem lança (a RLS impõe).
 */
const overviewRow = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  goal_cents: z.number().nullable(),
  visibility: z.enum(FUND_VISIBILITIES),
  is_active: z.boolean(),
  pix_key: z.string().nullable(),
  pix_holder: z.string().nullable(),
  pix_instructions: z.string().nullable(),
  raised_cents: z.number(),
  spent_cents: z.number().nullable(),
  balance_cents: z.number().nullable(),
});
export type FundOverview = z.infer<typeof overviewRow>;

export async function listFundOverviews(): Promise<FundOverview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fund_overview");
  if (error) throw new Error(`Falha ao ler as caixinhas: ${error.message}`);
  return z.array(overviewRow).parse(data ?? []);
}

export async function getFundOverview(id: string): Promise<FundOverview | null> {
  if (!z.uuid().safeParse(id).success) return null;
  return (await listFundOverviews()).find((fund) => fund.id === id) ?? null;
}

const cashflowRow = z.object({ month: z.string(), income_cents: z.number(), expense_cents: z.number() });
export type CashflowMonth = z.infer<typeof cashflowRow>;

export async function getCashflow(fundId: string): Promise<CashflowMonth[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fund_cashflow", { p_fund_id: fundId });
  if (error) throw new Error(`Falha ao ler o fluxo de caixa: ${error.message}`);
  return z.array(cashflowRow).parse(data ?? []);
}

const expenseRow = z.object({
  id: z.uuid(),
  occurred_on: z.string(),
  category: z.string().nullable(),
  description: z.string(),
  amount_cents: z.number(),
  is_reversal: z.boolean(),
});
export type ExpenseRow = z.infer<typeof expenseRow>;

export async function getExpenses(fundId: string): Promise<ExpenseRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fund_expenses", { p_fund_id: fundId, p_limit: 100, p_offset: 0 });
  if (error) throw new Error(`Falha ao ler as saídas: ${error.message}`);
  return z.array(expenseRow).parse(data ?? []);
}

// --- Gestão (RLS: finance.write ou responsável pela caixinha) -------------------------------
const fundRow = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  goal_cents: z.number().nullable(),
  visibility: z.enum(FUND_VISIBILITIES),
  pix_key: z.string().nullable(),
  pix_holder: z.string().nullable(),
  pix_instructions: z.string().nullable(),
  is_active: z.boolean(),
});
export type FundRow = z.infer<typeof fundRow>;

const FUND_COLUMNS = "id, name, description, goal_cents, visibility, pix_key, pix_holder, pix_instructions, is_active";

/** Caixinhas que a pessoa pode gerenciar (todas, para quem tem `finance.write`). */
export async function listManagedFunds(): Promise<FundRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("funds").select(FUND_COLUMNS).order("created_at");
  if (error) throw new Error(`Falha ao ler as caixinhas: ${error.message}`);
  return z.array(fundRow).parse(data ?? []);
}

export async function getManagedFund(id: string): Promise<FundRow | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("funds").select(FUND_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao ler a caixinha: ${error.message}`);
  return data ? fundRow.parse(data) : null;
}

const entryRow = z.object({
  id: z.uuid(),
  kind: z.enum(["income", "expense"]),
  amount_cents: z.number(),
  occurred_on: z.string(),
  category: z.string().nullable(),
  description: z.string(),
  reverses_id: z.uuid().nullable(),
});
export type EntryRow = z.infer<typeof entryRow>;

export async function listEntries(fundId: string): Promise<EntryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("id, kind, amount_cents, occurred_on, category, description, reverses_id")
    .eq("fund_id", fundId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Falha ao ler os lançamentos: ${error.message}`);
  return z.array(entryRow).parse(data ?? []);
}

const managerRow = z.object({ member_id: z.uuid(), display_name: z.string(), added_at: z.string() });
export type FundManager = z.infer<typeof managerRow>;

export async function listFundManagers(fundId: string): Promise<FundManager[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_list_fund_managers", { p_fund_id: fundId });
  if (error) throw new Error(`Falha ao ler os responsáveis: ${error.message}`);
  return z.array(managerRow).parse(data ?? []);
}

/** Integrantes ativos para escolher um responsável (até 60, filtrados pelo nome). */
export async function listMemberOptions(query?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_directory", { p_query: query || null, p_limit: 60 });
  if (error) throw new Error(`Falha ao listar integrantes: ${error.message}`);
  return z
    .array(z.object({ member_id: z.uuid(), display_name: z.string() }))
    .parse(data ?? [])
    .map((row) => ({ id: row.member_id, name: row.display_name }));
}

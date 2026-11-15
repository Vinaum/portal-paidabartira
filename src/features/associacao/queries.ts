import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { ASSOCIATION_STATUSES, DOC_KINDS, DUE_STATUSES } from "./schemas";

export const ASSOCIATION_BUCKET = "association-media";

/** Pedido ou situação do próprio integrante (a RLS só devolve a linha dele). */
export async function getMyAssociation(memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("association_members")
    .select("status, requested_at, joined_on")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler a adesão: ${error.message}`);
  return data
    ? z.object({ status: z.enum(ASSOCIATION_STATUSES), requested_at: z.string(), joined_on: z.string().nullable() }).parse(data)
    : null;
}

const summaryRow = z.object({
  raised_cents: z.number(),
  spent_cents: z.number(),
  balance_cents: z.number(),
  associates: z.number(),
});
export async function getSummary() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("association_summary");
  if (error) throw new Error(`Falha ao ler o resumo: ${error.message}`);
  const row = z.array(summaryRow).parse(data ?? [])[0];
  return row ?? null;
}

const cashflowRow = z.object({ month: z.string(), income_cents: z.number(), expense_cents: z.number() });
export async function getCashflow() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("association_cashflow");
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
export async function getExpenses() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("association_expenses", { p_limit: 100, p_offset: 0 });
  if (error) throw new Error(`Falha ao ler as saídas: ${error.message}`);
  return z.array(expenseRow).parse(data ?? []);
}

const settingsRow = z.object({
  pix_key: z.string().nullable(),
  pix_holder: z.string().nullable(),
  pix_instructions: z.string().nullable(),
  monthly_cents: z.number().nullable(),
});
export type AssociationSettings = z.infer<typeof settingsRow>;
export async function getSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("association_get_settings");
  if (error) throw new Error(`Falha ao ler o PIX da Associação: ${error.message}`);
  return z.array(settingsRow).parse(data ?? [])[0] ?? null;
}

const myDueRow = z.object({
  id: z.uuid(),
  ref_month: z.string(),
  amount_cents: z.number(),
  status: z.enum(DUE_STATUSES),
  informed_at: z.string(),
});
export type MyDue = z.infer<typeof myDueRow>;
export async function listMyDues(memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("association_dues")
    .select("id, ref_month, amount_cents, status, informed_at")
    .eq("member_id", memberId)
    .order("ref_month", { ascending: false })
    .limit(36);
  if (error) throw new Error(`Falha ao ler as mensalidades: ${error.message}`);
  return z.array(myDueRow).parse(data ?? []);
}

const documentRow = z.object({
  id: z.uuid(),
  kind: z.enum(DOC_KINDS),
  title: z.string(),
  description: z.string().nullable(),
  doc_date: z.string(),
  path: z.string(),
  size_bytes: z.number(),
});
export type AssociationDocument = Omit<z.infer<typeof documentRow>, "path"> & { url: string | null };

/** Documentos com link assinado de 1 hora; a RLS decide quem lista. */
export async function listDocuments(): Promise<AssociationDocument[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("association_documents")
    .select("id, kind, title, description, doc_date, path, size_bytes")
    .order("doc_date", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Falha ao ler os documentos: ${error.message}`);
  const rows = z.array(documentRow).parse(data ?? []);
  const urls = new Map<string, string>();
  if (rows.length > 0) {
    const { data: signed } = await createAdminClient()
      .storage.from(ASSOCIATION_BUCKET)
      .createSignedUrls(
        rows.map((row) => row.path),
        3600,
      );
    for (const item of signed ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return rows.map(({ path, ...row }) => ({ ...row, url: urls.get(path) ?? null }));
}

// --- Gestão (as funções conferem `association.manage`) --------------------------------------
const memberListRow = z.object({
  member_id: z.uuid(),
  display_name: z.string(),
  category: z.enum(["atual_morador", "ex_morador", "agregado"]),
  status: z.enum(ASSOCIATION_STATUSES),
  requested_at: z.string(),
  joined_on: z.string().nullable(),
});
export type AssociationMemberRow = z.infer<typeof memberListRow>;
export async function listAssociationMembers() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("association_list_members");
  if (error) throw new Error(`Falha ao ler os associados: ${error.message}`);
  return z.array(memberListRow).parse(data ?? []);
}

const dueListRow = z.object({
  id: z.uuid(),
  member_id: z.uuid(),
  display_name: z.string(),
  ref_month: z.string(),
  amount_cents: z.number(),
  status: z.enum(DUE_STATUSES),
  informed_at: z.string(),
});
export type DueRow = z.infer<typeof dueListRow>;
export async function listDues(status?: (typeof DUE_STATUSES)[number]) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("association_list_dues", { p_status: status ?? null, p_limit: 100 });
  if (error) throw new Error(`Falha ao ler as mensalidades: ${error.message}`);
  return z.array(dueListRow).parse(data ?? []);
}

const ledgerRow = z.object({
  id: z.uuid(),
  kind: z.enum(["income", "expense"]),
  amount_cents: z.number(),
  occurred_on: z.string(),
  category: z.string().nullable(),
  description: z.string(),
  reverses_id: z.uuid().nullable(),
});
export type LedgerRow = z.infer<typeof ledgerRow>;
export async function listLedger() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("association_ledger")
    .select("id, kind, amount_cents, occurred_on, category, description, reverses_id")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Falha ao ler o livro-caixa: ${error.message}`);
  const rows = z.array(ledgerRow).parse(data ?? []);
  const reversed = new Set(rows.map((row) => row.reverses_id).filter(Boolean));
  return rows.map((row) => ({ ...row, isReversed: reversed.has(row.id) }));
}

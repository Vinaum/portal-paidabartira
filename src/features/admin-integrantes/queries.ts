import "server-only";

import { z } from "zod";

import { MEMBER_CATEGORIES, MEMBER_ROLES, MEMBER_STATUSES } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

import { ADMIN_PAGE_SIZE, type MemberListFilters } from "./schemas";

/**
 * Leituras administrativas. Cada função do banco confere a permissão
 * (`members.manage` ou `privacy.handle`) e devolve só o que a tela precisa.
 */
const listRow = z.object({
  member_id: z.uuid(),
  full_name: z.string(),
  display_name: z.string(),
  category: z.enum(MEMBER_CATEGORIES),
  is_founder: z.boolean(),
  role: z.enum(MEMBER_ROLES),
  status: z.enum(MEMBER_STATUSES),
  activated_at: z.string(),
  total: z.coerce.number(),
});
export type AdminMemberRow = Omit<z.infer<typeof listRow>, "total">;

export async function listMembers(filters: MemberListFilters) {
  const page = filters.pagina ?? 1;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_members", {
    p_query: filters.q ?? null,
    p_status: filters.situacao ?? null,
    p_category: filters.categoria ?? null,
    p_role: filters.papel ?? null,
    p_limit: ADMIN_PAGE_SIZE,
    p_offset: (page - 1) * ADMIN_PAGE_SIZE,
  });
  if (error) throw new Error(`Falha ao listar integrantes: ${error.message}`);
  const rows = z.array(listRow).parse(data ?? []);
  const total = rows[0]?.total ?? 0;
  return {
    members: rows.map((row): AdminMemberRow => ({
      member_id: row.member_id,
      full_name: row.full_name,
      display_name: row.display_name,
      category: row.category,
      is_founder: row.is_founder,
      role: row.role,
      status: row.status,
      activated_at: row.activated_at,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
  };
}

const detailRow = z.object({
  member_id: z.uuid(),
  full_name: z.string(),
  display_name: z.string(),
  login_email: z.string().nullable(),
  category: z.enum(MEMBER_CATEGORIES),
  is_founder: z.boolean(),
  role: z.enum(MEMBER_ROLES),
  status: z.enum(MEMBER_STATUSES),
  activated_at: z.string(),
  open_deletion_request: z.uuid().nullable(),
});
export type AdminMember = z.infer<typeof detailRow>;

export async function getAdminMember(id: string): Promise<AdminMember | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_get_member", { p_member_id: id });
  if (error) throw new Error(`Falha ao ler o integrante: ${error.message}`);
  const row = z.array(detailRow).parse(data ?? [])[0];
  return row ?? null;
}

const historyRow = z.object({
  field: z.string(),
  old_value: z.string().nullable(),
  new_value: z.string().nullable(),
  reason: z.string().nullable(),
  changed_at: z.string(),
  changed_by_name: z.string().nullable(),
});
export type HistoryEntry = z.infer<typeof historyRow>;

export async function getMemberHistory(id: string): Promise<HistoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_member_history", { p_member_id: id });
  if (error) throw new Error(`Falha ao ler o histórico: ${error.message}`);
  return z.array(historyRow).parse(data ?? []);
}

const requestRow = z.object({
  id: z.uuid(),
  member_id: z.uuid(),
  member_name: z.string(),
  member_role: z.enum(MEMBER_ROLES),
  member_status: z.enum(MEMBER_STATUSES),
  kind: z.enum(["deletion", "correction", "export"]),
  details: z.string().nullable(),
  status: z.enum(["open", "in_progress", "done", "rejected"]),
  resolution: z.string().nullable(),
  handled_by_name: z.string().nullable(),
  handled_at: z.string().nullable(),
  created_at: z.string(),
});
export type DataRequestRow = z.infer<typeof requestRow>;

export async function listDataRequests(status?: DataRequestRow["status"]): Promise<DataRequestRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_data_requests", { p_status: status ?? null });
  if (error) throw new Error(`Falha ao listar pedidos de dados: ${error.message}`);
  return z.array(requestRow).parse(data ?? []);
}

export async function countOpenDataRequests(): Promise<number> {
  const rows = await listDataRequests();
  return rows.filter((row) => row.status === "open" || row.status === "in_progress").length;
}

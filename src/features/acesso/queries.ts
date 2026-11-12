import "server-only";

import { z } from "zod";

import { MEMBER_CATEGORIES, MEMBER_ROLES } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

import { REQUEST_STATUSES, type RequestStatus } from "./schemas";

/**
 * Leitura das solicitações. Tudo passa pela RLS: só quem tem a permissão
 * `requests.review` recebe linhas; os demais recebem lista vazia.
 */
const requestSchema = z.object({
  id: z.uuid(),
  full_name: z.string(),
  nickname: z.string().nullable(),
  email: z.string(),
  phone: z.string().nullable(),
  relationship: z.string(),
  justification: z.string(),
  extra_info: z.string().nullable(),
  policy_version: z.string(),
  status: z.enum(REQUEST_STATUSES),
  assigned_category: z.enum(MEMBER_CATEGORIES).nullable(),
  assigned_is_founder: z.boolean(),
  assigned_role: z.enum(MEMBER_ROLES),
  info_request: z.string().nullable(),
  admin_notes: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  created_at: z.string(),
});
export type AccessRequest = z.infer<typeof requestSchema>;

const COLUMNS =
  "id, full_name, nickname, email, phone, relationship, justification, extra_info, policy_version, " +
  "status, assigned_category, assigned_is_founder, assigned_role, info_request, admin_notes, reviewed_at, created_at";

export async function listAccessRequests(status?: RequestStatus): Promise<AccessRequest[]> {
  const supabase = await createClient();
  let query = supabase
    .from("membership_requests")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao listar solicitações: ${error.message}`);
  return z.array(requestSchema).parse(data);
}

export async function getAccessRequest(id: string): Promise<AccessRequest | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("membership_requests")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler a solicitação: ${error.message}`);
  return data ? requestSchema.parse(data) : null;
}

export async function countPendingRequests(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("membership_requests")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "needs_info"]);
  if (error) throw new Error(`Falha ao contar solicitações: ${error.message}`);
  return count ?? 0;
}

const invitationSchema = z.object({
  id: z.uuid(),
  auth_user_id: z.uuid(),
  sent_at: z.string(),
  accepted_at: z.string().nullable(),
});
export type Invitation = z.infer<typeof invitationSchema>;

export async function listInvitations(requestId: string): Promise<Invitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("id, auth_user_id, sent_at, accepted_at")
    .eq("request_id", requestId)
    .order("sent_at", { ascending: false });
  if (error) throw new Error(`Falha ao ler convites: ${error.message}`);
  return z.array(invitationSchema).parse(data);
}

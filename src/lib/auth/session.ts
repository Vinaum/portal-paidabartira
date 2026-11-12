import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import {
  MEMBER_CATEGORIES,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  canAccessAdmin,
  isPermission,
  type Permission,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * Camada de acesso à sessão. Tudo aqui é lido do banco a cada requisição
 * (apenas deduplicado dentro da mesma requisição com `cache`), para que
 * suspensão e troca de papel valham imediatamente.
 */

const memberRowSchema = z.object({
  id: z.uuid(),
  category: z.enum(MEMBER_CATEGORIES),
  is_founder: z.boolean(),
  role: z.enum(MEMBER_ROLES),
  status: z.enum(MEMBER_STATUSES),
});

export type SessionUser = { id: string; email: string | null };

export type CurrentMember = {
  id: string;
  email: string | null;
  category: z.infer<typeof memberRowSchema>["category"];
  isFounder: boolean;
  role: z.infer<typeof memberRowSchema>["role"];
  status: z.infer<typeof memberRowSchema>["status"];
  displayName: string;
  permissions: Permission[];
};

/** Usuário autenticado (token com assinatura validada) ou null. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;
  const email = data.claims.email;
  return { id: sub, email: typeof email === "string" ? email : null };
});

/** Vínculo do usuário com a república, ou null se a conta não foi ativada. */
export const getCurrentMember = cache(async (): Promise<CurrentMember | null> => {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("members")
    .select("id, category, is_founder, role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler o vínculo: ${error.message}`);
  if (!row) return null;
  const member = memberRowSchema.parse(row);

  const [{ data: profile }, { data: permissionRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("member_id", user.id)
      .maybeSingle(),
    supabase.rpc("my_permissions"),
  ]);

  const permissions = z
    .array(z.string())
    .catch([])
    .parse(permissionRows ?? [])
    .filter(isPermission);

  return {
    id: member.id,
    email: user.email,
    category: member.category,
    isFounder: member.is_founder,
    role: member.role,
    status: member.status,
    displayName:
      z.string().min(1).safeParse(profile?.display_name).data ?? "Integrante",
    permissions,
  };
});

/**
 * Exige membro ativo. Redireciona:
 *   sem sessão            -> /login
 *   convite não concluído -> /definir-senha
 *   suspenso/desativado   -> /conta-suspensa
 */
export async function requireActiveMember(): Promise<CurrentMember> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const member = await getCurrentMember();
  if (!member) redirect("/definir-senha");
  if (member.status !== "active") redirect("/conta-suspensa");
  return member;
}

/** Exige uma permissão específica; sem ela, volta ao painel do membro. */
export async function requirePermission(
  permission: Permission,
): Promise<CurrentMember> {
  const member = await requireActiveMember();
  if (!member.permissions.includes(permission)) redirect("/painel");
  return member;
}

/** Exige ao menos uma permissão administrativa (entrada do painel admin). */
export async function requireAdminAccess(): Promise<CurrentMember> {
  const member = await requireActiveMember();
  if (!canAccessAdmin(member.permissions)) redirect("/painel");
  return member;
}

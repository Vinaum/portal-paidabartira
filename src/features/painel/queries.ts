import "server-only";

import { countPendingRequests } from "@/features/acesso/queries";
import { countOpenDataRequests } from "@/features/admin-integrantes/queries";
import { isShopManager, listOrders } from "@/features/loja/queries";
import { getOwnProfile } from "@/features/perfis/queries";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

import { profileChecklist } from "./checklist";

export async function getProfileChecklist(memberId: string) {
  const supabase = await createClient();
  const [own, photo] = await Promise.all([
    getOwnProfile(memberId),
    supabase.from("profile_photo").select("member_id").eq("member_id", memberId).maybeSingle(),
  ]);
  const social = own.social ? Object.values(own.social).some(Boolean) : false;
  return profileChecklist({
    hasPhoto: Boolean(photo.data),
    bio: own.profile.bio,
    periodCount: own.periods.length,
    hasBirthday: Boolean(own.birthday),
    hasContact: Boolean(own.emails?.official_email || own.phone?.phone || own.phone?.whatsapp) || social,
    hasEducationOrWork: own.education.length > 0 || Boolean(own.professional?.company || own.professional?.job_title),
  });
}

export type Pending = { label: string; count: number; href: string };

/** Pendências de quem administra, só das áreas em que a pessoa tem permissão. */
export async function getAdminPending(permissions: readonly Permission[]): Promise<Pending[]> {
  const has = (permission: Permission) => permissions.includes(permission);
  const [requests, dataRequests, orders] = await Promise.all([
    has(PERMISSIONS.requestsReview) ? countPendingRequests() : Promise.resolve(null),
    has(PERMISSIONS.privacyHandle) ? countOpenDataRequests() : Promise.resolve(null),
    (await isShopManager(has(PERMISSIONS.storeManage))) ? listOrders("requested").then((rows) => rows.length) : Promise.resolve(null),
  ]);
  const pending: Pending[] = [];
  if (requests !== null) pending.push({ label: "Solicitações de acesso", count: requests, href: "/admin/solicitacoes" });
  if (dataRequests !== null) pending.push({ label: "Pedidos de dados (LGPD)", count: dataRequests, href: "/admin/privacidade" });
  if (orders !== null) pending.push({ label: "Pedidos da loja aguardando confirmação", count: orders, href: "/pedidos/gestao?status=requested" });
  return pending;
}

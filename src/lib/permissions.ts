/**
 * Nomes das permissões. Fonte única na aplicação; os mesmos nomes estão na
 * tabela `permissions` (migration 20261112000100_base.sql) e nas políticas
 * de RLS. Um teste garante que as duas listas não divergem.
 */
export const PERMISSIONS = {
  membersManage: "members.manage",
  membersAssignModerator: "members.assign_moderator",
  requestsReview: "requests.review",
  eventsManage: "events.manage",
  storiesModerate: "stories.moderate",
  announcementsPublish: "announcements.publish",
  storeManage: "store.manage",
  financeWrite: "finance.write",
  settingsManage: "settings.manage",
  auditRead: "audit.read",
  privacyHandle: "privacy.handle",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

export const MEMBER_ROLES = [
  "membro",
  "moderador",
  "administrador",
  "superadmin",
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_CATEGORIES = [
  "atual_morador",
  "ex_morador",
  "agregado",
] as const;
export type MemberCategory = (typeof MEMBER_CATEGORIES)[number];

export const MEMBER_STATUSES = ["active", "suspended", "deactivated"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const ROLE_LABELS: Record<MemberRole, string> = {
  membro: "Membro",
  moderador: "Moderador",
  administrador: "Administrador",
  superadmin: "Superadmin",
};

export const CATEGORY_LABELS: Record<MemberCategory, string> = {
  atual_morador: "Atual morador",
  ex_morador: "Ex-morador",
  agregado: "Agregado",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "members.manage": "Gerenciar integrantes",
  "members.assign_moderator": "Atribuir moderadores",
  "requests.review": "Analisar solicitações de acesso",
  "events.manage": "Gerenciar eventos",
  "stories.moderate": "Moderar histórias",
  "announcements.publish": "Publicar comunicados",
  "store.manage": "Gerenciar loja e encomendas",
  "finance.write": "Lançar na caixinha",
  "settings.manage": "Editar configurações",
  "audit.read": "Consultar auditoria",
  "privacy.handle": "Atender pedidos de dados (LGPD)",
};

export function isPermission(value: string): value is Permission {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}

/** Quem tem ao menos uma permissão enxerga o painel administrativo. */
export function canAccessAdmin(permissions: readonly Permission[]): boolean {
  return permissions.length > 0;
}

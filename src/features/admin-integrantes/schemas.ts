import { z } from "zod";

import { MEMBER_CATEGORIES, MEMBER_ROLES, MEMBER_STATUSES } from "@/lib/permissions";

export const ADMIN_PAGE_SIZE = 30;

export const STATUS_LABELS = {
  active: "Ativo",
  suspended: "Suspenso",
  deactivated: "Desativado",
} as const satisfies Record<(typeof MEMBER_STATUSES)[number], string>;

type RawParams = Record<string, string | string[] | undefined>;

const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

const listFiltersSchema = z.object({
  q: lenient(
    z
      .string()
      .trim()
      .max(80)
      .transform((value) => value || undefined),
  ),
  situacao: lenient(z.enum(MEMBER_STATUSES)),
  categoria: lenient(z.enum(MEMBER_CATEGORIES)),
  papel: lenient(z.enum(MEMBER_ROLES)),
  pagina: lenient(
    z
      .string()
      .regex(/^\d{1,4}$/)
      .transform(Number)
      .pipe(z.number().int().min(1)),
  ),
});
export type MemberListFilters = z.infer<typeof listFiltersSchema>;

export function parseMemberListFilters(raw: RawParams): MemberListFilters {
  const first = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  return listFiltersSchema.parse(first);
}

export function memberListSearch(filters: MemberListFilters, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (key === "pagina" || value === undefined) continue;
    params.set(key, String(value));
  }
  if (page > 1) params.set("pagina", String(page));
  const search = params.toString();
  return search ? `?${search}` : "";
}

const reason = z
  .string()
  .trim()
  .max(1000, "Use até 1000 caracteres.")
  .transform((value) => (value === "" ? null : value));

export const updateMemberSchema = z
  .object({
    memberId: z.uuid(),
    category: z.enum(MEMBER_CATEGORIES, { error: "Escolha a categoria." }),
    isFounder: z.boolean(),
    status: z.enum(MEMBER_STATUSES, { error: "Escolha a situação." }),
    reason,
  })
  .refine((value) => !value.isFounder || value.category === "ex_morador", {
    path: ["isFounder"],
    error: "O atributo fundador só vale para ex-moradores.",
  });

export const setRoleSchema = z.object({
  memberId: z.uuid(),
  role: z.enum(MEMBER_ROLES, { error: "Escolha o papel." }),
  reason,
});

export const resolveRequestSchema = z
  .object({
    requestId: z.uuid(),
    status: z.enum(["in_progress", "done", "rejected"]),
    resolution: z
      .string()
      .trim()
      .max(2000, "Use até 2000 caracteres.")
      .transform((value) => (value === "" ? null : value)),
  })
  .refine((value) => value.status === "in_progress" || value.resolution !== null, {
    path: ["resolution"],
    error: "Escreva a resposta dada ao titular.",
  });

export const DELETE_CONFIRMATION = "EXCLUIR";

export const deleteAccountSchema = z.object({
  requestId: z.uuid(),
  confirmation: z.literal(DELETE_CONFIRMATION, { error: `Digite ${DELETE_CONFIRMATION} para confirmar.` }),
});

export const REQUEST_KIND_LABELS: Record<string, string> = {
  deletion: "Exclusão de conta",
  correction: "Correção de dados",
  export: "Cópia dos dados",
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em análise",
  done: "Atendido",
  rejected: "Recusado",
};

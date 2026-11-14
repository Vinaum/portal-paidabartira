import { z } from "zod";

export const VISIBILITIES = ["public", "members", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "Público",
  members: "Somente membros",
  private: "Privado (só eu)",
};

export const PROFILE_SECTIONS = ["photo", "emails", "phone", "address", "professional", "academic", "social", "birthday"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

const visibility = z.enum(VISIBILITIES, { error: "Escolha quem pode ver." });

/** Texto opcional: vazio vira null. Limites iguais aos CHECKs do banco. */
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value));

const optionalYear = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : Number(value)))
  .pipe(z.number("Ano inválido.").int("Ano inválido.").min(1950, "Ano inválido.").max(2100, "Ano inválido.").nullable());

export const basicsSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo.").max(120, "Nome muito longo."),
  displayName: z.string().trim().min(1, "Informe como quer ser chamado.").max(60, "Use até 60 caracteres."),
  nickname: optional(60),
  bio: optional(2000),
  originCity: optional(80),
  originState: optional(80),
  originCountry: optional(80),
  currentCity: optional(80),
  currentCountry: optional(80),
  showOnPublicPortal: z.boolean(),
});

/** Mês no formato AAAA-MM (campo <input type="month">). */
const MONTH = /^(19[5-9]\d|20\d{2})-(0[1-9]|1[0-2])$/;
const currentMonth = () => new Date().toISOString().slice(0, 7);

export const periodSchema = z
  .object({
    startedOn: z.string().trim().regex(MONTH, "Informe mês e ano de entrada."),
    endedOn: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .pipe(z.string().regex(MONTH, "Mês inválido.").nullable()),
  })
  .refine((data) => data.startedOn <= currentMonth(), { path: ["startedOn"], message: "A entrada não pode ser no futuro." })
  .refine((data) => data.endedOn === null || data.endedOn <= currentMonth(), {
    path: ["endedOn"],
    message: "A saída não pode ser no futuro.",
  })
  .refine((data) => data.endedOn === null || data.endedOn >= data.startedOn, {
    path: ["endedOn"],
    message: "A saída não pode ser anterior à entrada.",
  });

export type Period = { startedOn: string; endedOn: string | null };

/** Dois períodos se sobrepõem? Meses no formato AAAA-MM; saída nula = até hoje. */
export function periodsOverlap(a: Period, b: Period): boolean {
  const endA = a.endedOn ?? "9999-12";
  const endB = b.endedOn ?? "9999-12";
  return a.startedOn <= endB && b.startedOn <= endA;
}

export const emailsSchema = z.object({
  officialEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "E-mail muito longo.")
    .transform((value) => (value === "" ? null : value))
    .pipe(z.email("Informe um e-mail válido.").nullable()),
  visibility,
});

const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Dia e mês (sem ano). Os dois vazios removem o aniversário; um só preenchido é erro. */
export const birthdaySchema = z
  .object({ day: z.string().trim(), month: z.string().trim(), visibility })
  .superRefine((value, ctx) => {
    if (value.day === "" && value.month === "") return;
    const day = Number(value.day);
    const month = Number(value.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      ctx.addIssue({ code: "custom", path: ["month"], message: "Escolha o mês." });
      return;
    }
    if (!Number.isInteger(day) || day < 1 || day > (MONTH_DAYS[month - 1] ?? 31)) {
      ctx.addIssue({ code: "custom", path: ["day"], message: "Dia inválido para este mês." });
    }
  })
  .transform((value) =>
    value.day === "" && value.month === ""
      ? { birthday: null, visibility: value.visibility }
      : { birthday: { day: Number(value.day), month: Number(value.month) }, visibility: value.visibility },
  );

export const phoneSchema = z.object({ phone: optional(30), whatsapp: optional(30), visibility });

export const addressSchema = z.object({
  street: optional(160),
  complement: optional(80),
  district: optional(80),
  city: optional(80),
  state: optional(80),
  postalCode: optional(20),
  country: optional(80),
  visibility,
});

const optionalUrl = (pattern: RegExp, message: string) =>
  optional(300).refine((value) => value === null || pattern.test(value), { message });

export const professionalSchema = z.object({
  company: optional(120),
  jobTitle: optional(120),
  field: optional(120),
  websiteUrl: optionalUrl(/^https?:\/\/\S+$/, "Use o endereço completo, começando com http:// ou https://"),
  pitch: optional(2000),
  skills: z
    .string()
    .max(1500, "Lista muito longa.")
    .transform((value) => [
      ...new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ])
    .refine((items) => items.length <= 30, "Use até 30 competências.")
    .refine((items) => items.every((item) => item.length <= 40), "Cada competência pode ter até 40 caracteres."),
  visibility,
});

export const COMPLETIONS = ["completed", "in_progress", "not_completed"] as const;
export type Completion = (typeof COMPLETIONS)[number];
export const COMPLETION_LABELS: Record<Completion, string> = {
  completed: "Concluído",
  in_progress: "Em curso",
  not_completed: "Não concluído",
};

export const educationSchema = z
  .object({
    course: z.string().trim().min(2, "Informe o curso.").max(120, "Use até 120 caracteres."),
    institution: z.string().trim().min(2, "Informe a instituição.").max(120, "Use até 120 caracteres."),
    startYear: optionalYear,
    endYear: optionalYear,
    completion: z.enum(COMPLETIONS, { error: "Escolha a situação." }),
  })
  .refine((data) => data.startYear === null || data.endYear === null || data.endYear >= data.startYear, {
    path: ["endYear"],
    message: "A conclusão não pode ser anterior ao ingresso.",
  });

export const rowIdSchema = z.object({ id: z.uuid() });
export const sectionVisibilitySchema = z.object({ section: z.enum(PROFILE_SECTIONS), visibility });

// ---------------------------------------------------------------------------
// Redes sociais
// ---------------------------------------------------------------------------
export const SOCIAL_NETWORKS = {
  linkedin: { label: "LinkedIn", hosts: ["linkedin.com"], base: "https://www.linkedin.com/in/" },
  instagram: { label: "Instagram", hosts: ["instagram.com"], base: "https://www.instagram.com/" },
  facebook: { label: "Facebook", hosts: ["facebook.com", "fb.com"], base: "https://www.facebook.com/" },
  x: { label: "X (Twitter)", hosts: ["x.com", "twitter.com"], base: "https://x.com/" },
  github: { label: "GitHub", hosts: ["github.com"], base: "https://github.com/" },
} as const;
export type SocialNetwork = keyof typeof SOCIAL_NETWORKS;

const HANDLE = /^@?[A-Za-z0-9_][A-Za-z0-9._-]{0,59}$/;

/**
 * Aceita o endereço completo ou só o nome de usuário ("@fulano") e devolve
 * sempre um endereço https da própria rede. Devolve `undefined` se o valor
 * não for da rede indicada (evita um link qualquer rotulado como Instagram).
 */
export function normalizeSocialUrl(network: SocialNetwork, raw: string): string | null | undefined {
  const value = raw.trim();
  if (value === "") return null;
  const { hosts, base } = SOCIAL_NETWORKS[network];

  const looksLikeAddress = value.includes("/") || hosts.some((host) => value.toLowerCase().includes(host));
  let candidate: string;
  if (!looksLikeAddress && HANDLE.test(value)) {
    candidate = base + value.replace(/^@/, "");
  } else {
    candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return undefined;
  }
  const host = url.hostname.toLowerCase();
  const sameNetwork = hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  if (url.protocol !== "https:" || !sameNetwork || url.username || url.password) return undefined;
  if (candidate.length > 300) return undefined;
  return url.toString();
}

const socialField = (network: SocialNetwork) =>
  z.string().transform((value, context) => {
    const normalized = normalizeSocialUrl(network, value);
    if (normalized === undefined) {
      context.addIssue({
        code: "custom",
        message: `Use o endereço do seu perfil no ${SOCIAL_NETWORKS[network].label} ou só o seu @usuário.`,
      });
      return z.NEVER;
    }
    return normalized;
  });

export const socialSchema = z.object({
  linkedin: socialField("linkedin"),
  instagram: socialField("instagram"),
  facebook: socialField("facebook"),
  x: socialField("x"),
  github: socialField("github"),
  other: optionalUrl(/^https:\/\/\S+$/, "Use o endereço completo, começando com https://"),
  visibility,
});

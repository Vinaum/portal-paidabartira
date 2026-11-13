import { z } from "zod";

export const VISIBILITIES = ["public", "members", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "Público",
  members: "Somente membros",
  private: "Privado (só eu)",
};

export const PROFILE_SECTIONS = ["photo", "emails", "phone", "address", "professional", "academic"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

const visibility = z.enum(VISIBILITIES, { error: "Escolha quem pode ver." });

/** Texto opcional: vazio vira null. Limites iguais aos CHECKs do banco. */
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use até ${max} caracteres.`)
    .transform((value) => (value === "" ? null : value));

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .pipe(z.iso.date("Data inválida.").nullable());

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

export const residencySchema = z
  .object({ joinedOn: optionalDate, leftOn: optionalDate })
  .refine((data) => !data.joinedOn || !data.leftOn || data.leftOn >= data.joinedOn, {
    path: ["leftOn"],
    message: "A saída não pode ser anterior à entrada.",
  });

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
  linkedinUrl: optionalUrl(/^https:\/\/\S+$/, "Use o endereço completo, começando com https://"),
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

export const educationSchema = z
  .object({
    course: z.string().trim().min(2, "Informe o curso.").max(120, "Use até 120 caracteres."),
    institution: z.string().trim().min(2, "Informe a instituição.").max(120, "Use até 120 caracteres."),
    startYear: optionalYear,
    endYear: optionalYear,
  })
  .refine((data) => data.startYear === null || data.endYear === null || data.endYear >= data.startYear, {
    path: ["endYear"],
    message: "A conclusão não pode ser anterior ao ingresso.",
  });

export const educationDeleteSchema = z.object({ id: z.uuid() });
export const sectionVisibilitySchema = z.object({ section: z.enum(PROFILE_SECTIONS), visibility });

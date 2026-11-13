import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { MEMBER_CATEGORIES } from "@/lib/permissions";

import { COMPLETIONS, SOCIAL_NETWORKS } from "../perfis/schemas";
import { PAGE_SIZE, type DirectoryFilters } from "./schemas";

const BUCKET = "member-media";
const PHOTO_TTL_SECONDS = 60 * 60;

const text = z.string().nullable();
const rowSchema = z.object({
  member_id: z.uuid(),
  display_name: z.string(),
  nickname: text,
  category: z.enum(MEMBER_CATEGORIES),
  is_founder: z.boolean(),
  current_city: text,
  current_country: text,
  photo_path: text,
  job_title: text,
  company: text,
  courses: z.array(z.string()),
  periods: z.array(z.object({ started_on: z.string(), ended_on: text })),
  total: z.coerce.number(),
});

export type DirectoryEntry = Omit<z.infer<typeof rowSchema>, "total"> & { photoUrl: string | null };

/**
 * Endereços temporários das fotos. A política do storage confere a visibilidade
 * da foto de cada dono; quem não pode ver fica sem endereço.
 */
export async function signPhotos(paths: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;
  const supabase = await createClient();
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(unique, PHOTO_TTL_SECONDS);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

export async function searchDirectory(
  filters: DirectoryFilters,
): Promise<{ entries: DirectoryEntry[]; total: number; page: number; pages: number }> {
  const page = filters.pagina ?? 1;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_directory", {
    p_query: filters.q ?? null,
    p_category: filters.categoria ?? null,
    p_founders_only: filters.fundadores === "1",
    p_course: filters.curso ?? null,
    p_institution: filters.instituicao ?? null,
    p_graduation_year: filters.formatura ?? null,
    p_resident_year: filters.morou ?? null,
    p_profession: filters.profissao ?? null,
    p_company: filters.empresa ?? null,
    p_city: filters.cidade ?? null,
    p_country: filters.pais ?? null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw new Error(`Falha na busca do diretório: ${error.message}`);

  const rows = z.array(rowSchema).parse(data ?? []);
  const urls = await signPhotos(rows.map((row) => row.photo_path));
  const total = rows[0]?.total ?? 0;
  return {
    entries: rows.map((row) => ({
      member_id: row.member_id,
      display_name: row.display_name,
      nickname: row.nickname,
      category: row.category,
      is_founder: row.is_founder,
      current_city: row.current_city,
      current_country: row.current_country,
      photo_path: row.photo_path,
      job_title: row.job_title,
      company: row.company,
      courses: row.courses,
      periods: row.periods,
      photoUrl: row.photo_path ? (urls.get(row.photo_path) ?? null) : null,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

// ---------------------------------------------------------------------------
// Perfil individual. Cada seção é lida da sua tabela, e a RLS devolve vazio
// quando o dono não deixou ver; por isso "sem dados" e "escondido" são
// indistinguíveis para quem olha, de propósito.
// ---------------------------------------------------------------------------
const socialKeys = [...Object.keys(SOCIAL_NETWORKS), "other"] as const;

export type MemberProfile = {
  id: string;
  category: (typeof MEMBER_CATEGORIES)[number];
  isFounder: boolean;
  fullName: string;
  displayName: string;
  nickname: string | null;
  bio: string | null;
  origin: string | null;
  current: string | null;
  photoUrl: string | null;
  periods: { id: string; started_on: string; ended_on: string | null }[];
  education: {
    id: string;
    course: string;
    institution: string;
    start_year: number | null;
    end_year: number | null;
    completion: (typeof COMPLETIONS)[number];
  }[];
  professional: {
    company: string | null;
    job_title: string | null;
    field: string | null;
    website_url: string | null;
    pitch: string | null;
    skills: string[];
  } | null;
  social: { network: string; url: string }[];
  officialEmail: string | null;
  phone: { phone: string | null; whatsapp: string | null } | null;
  address: string | null;
};

const place = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(", ") || null;

export async function getMemberProfile(id: string): Promise<MemberProfile | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const of = (table: string, columns: string) => supabase.from(table).select(columns).eq("member_id", id);

  const [member, profile, photo, periods, education, professional, social, emails, phone, address] = await Promise.all([
    supabase.from("members").select("id, category, is_founder, status").eq("id", id).maybeSingle(),
    of(
      "profiles",
      "full_name, display_name, nickname, bio, origin_city, origin_state, origin_country, current_city, current_country",
    ).maybeSingle(),
    of("profile_photo", "media_path").maybeSingle(),
    of("residency_periods", "id, started_on, ended_on").order("started_on", { ascending: true }),
    of("education", "id, course, institution, start_year, end_year, completion").order("start_year", {
      ascending: false,
      nullsFirst: false,
    }),
    of("profile_professional", "company, job_title, field, website_url, pitch, skills").maybeSingle(),
    of("profile_social", "linkedin_url, instagram_url, facebook_url, x_url, github_url, other_url").maybeSingle(),
    of("profile_emails", "official_email").maybeSingle(),
    of("profile_phone", "phone, whatsapp").maybeSingle(),
    of("profile_address", "street, complement, district, city, state, postal_code, country").maybeSingle(),
  ]);

  for (const result of [member, profile, photo, periods, education, professional, social, emails, phone, address]) {
    if (result.error) throw new Error(`Falha ao ler o perfil: ${result.error.message}`);
  }
  if (!member.data || !profile.data) return null;

  const m = z
    .object({ id: z.uuid(), category: z.enum(MEMBER_CATEGORIES), is_founder: z.boolean(), status: z.string() })
    .parse(member.data);
  const p = z
    .object({
      full_name: z.string(),
      display_name: z.string(),
      nickname: text,
      bio: text,
      origin_city: text,
      origin_state: text,
      origin_country: text,
      current_city: text,
      current_country: text,
    })
    .parse(profile.data);

  const photoPath = photo.data ? z.object({ media_path: z.string() }).parse(photo.data).media_path : null;
  const photoUrl = photoPath ? ((await signPhotos([photoPath])).get(photoPath) ?? null) : null;

  const socialRow = social.data ? z.record(z.string(), text).parse(social.data) : {};
  const addressRow = address.data ? z.record(z.string(), text).parse(address.data) : null;
  const phoneRow = phone.data ? z.object({ phone: text, whatsapp: text }).parse(phone.data) : null;

  return {
    id: m.id,
    category: m.category,
    isFounder: m.is_founder,
    fullName: p.full_name,
    displayName: p.display_name,
    nickname: p.nickname,
    bio: p.bio,
    origin: place([p.origin_city, p.origin_state, p.origin_country]),
    current: place([p.current_city, p.current_country]),
    photoUrl,
    periods: z
      .array(z.object({ id: z.uuid(), started_on: z.string(), ended_on: text }))
      .parse(periods.data),
    education: z
      .array(
        z.object({
          id: z.uuid(),
          course: z.string(),
          institution: z.string(),
          start_year: z.number().nullable(),
          end_year: z.number().nullable(),
          completion: z.enum(COMPLETIONS),
        }),
      )
      .parse(education.data),
    professional: professional.data
      ? z
          .object({
            company: text,
            job_title: text,
            field: text,
            website_url: text,
            pitch: text,
            skills: z.array(z.string()),
          })
          .parse(professional.data)
      : null,
    social: socialKeys.flatMap((key) => {
      const url = socialRow[`${key}_url`];
      return url ? [{ network: key, url }] : [];
    }),
    officialEmail: emails.data ? z.object({ official_email: text }).parse(emails.data).official_email : null,
    phone: phoneRow && (phoneRow.phone || phoneRow.whatsapp) ? phoneRow : null,
    address: addressRow
      ? place([
          addressRow.street,
          addressRow.complement,
          addressRow.district,
          addressRow.city,
          addressRow.state,
          addressRow.postal_code,
          addressRow.country,
        ])
      : null,
  };
}

/** Endereço temporário da foto do próprio integrante (para a tela de edição). */
export async function getOwnPhotoUrl(memberId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profile_photo").select("media_path").eq("member_id", memberId).maybeSingle();
  if (error) throw new Error(`Falha ao ler a foto: ${error.message}`);
  if (!data) return null;
  const path = z.object({ media_path: z.string() }).parse(data).media_path;
  return (await signPhotos([path])).get(path) ?? null;
}

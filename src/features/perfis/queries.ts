import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { COMPLETIONS, PROFILE_SECTIONS, VISIBILITIES, type ProfileSection, type Visibility } from "./schemas";

const text = z.string().nullable();

const profileSchema = z.object({
  full_name: z.string(),
  display_name: z.string(),
  nickname: text,
  bio: text,
  origin_city: text,
  origin_state: text,
  origin_country: text,
  current_city: text,
  current_country: text,
  show_on_public_portal: z.boolean(),
});
const periodSchema = z.object({ id: z.uuid(), started_on: z.string(), ended_on: text });
const socialSchema = z.object({
  linkedin_url: text,
  instagram_url: text,
  facebook_url: text,
  x_url: text,
  github_url: text,
  other_url: text,
});
const emailsSchema = z.object({ official_email: text });
const phoneSchema = z.object({ phone: text, whatsapp: text });
const addressSchema = z.object({
  street: text,
  complement: text,
  district: text,
  city: text,
  state: text,
  postal_code: text,
  country: text,
});
const professionalSchema = z.object({
  company: text,
  job_title: text,
  field: text,
  website_url: text,
  pitch: text,
  skills: z.array(z.string()),
});
const educationSchema = z.object({
  id: z.uuid(),
  course: z.string(),
  institution: z.string(),
  start_year: z.number().nullable(),
  end_year: z.number().nullable(),
  completion: z.enum(COMPLETIONS),
});
const privacySchema = z.object({ section: z.enum(PROFILE_SECTIONS), visibility: z.enum(VISIBILITIES) });

export type OwnProfile = {
  profile: z.infer<typeof profileSchema>;
  periods: z.infer<typeof periodSchema>[];
  social: z.infer<typeof socialSchema> | null;
  emails: z.infer<typeof emailsSchema> | null;
  phone: z.infer<typeof phoneSchema> | null;
  address: z.infer<typeof addressSchema> | null;
  professional: z.infer<typeof professionalSchema> | null;
  education: z.infer<typeof educationSchema>[];
  privacy: Record<ProfileSection, Visibility>;
};

/** Perfil completo do próprio integrante, para a tela de edição. */
export async function getOwnProfile(memberId: string): Promise<OwnProfile> {
  const supabase = await createClient();
  const own = <T extends string>(table: T, columns: string) =>
    supabase.from(table).select(columns).eq("member_id", memberId);

  const [profile, periods, social, emails, phone, address, professional, education, privacy] = await Promise.all([
    own(
      "profiles",
      "full_name, display_name, nickname, bio, origin_city, origin_state, origin_country, current_city, current_country, show_on_public_portal",
    ).single(),
    own("residency_periods", "id, started_on, ended_on").order("started_on", { ascending: true }),
    own("profile_social", "linkedin_url, instagram_url, facebook_url, x_url, github_url, other_url").maybeSingle(),
    own("profile_emails", "official_email").maybeSingle(),
    own("profile_phone", "phone, whatsapp").maybeSingle(),
    own("profile_address", "street, complement, district, city, state, postal_code, country").maybeSingle(),
    own("profile_professional", "company, job_title, field, website_url, pitch, skills").maybeSingle(),
    own("education", "id, course, institution, start_year, end_year, completion").order("start_year", {
      ascending: false,
      nullsFirst: false,
    }),
    own("profile_privacy", "section, visibility"),
  ]);

  for (const result of [profile, periods, social, emails, phone, address, professional, education, privacy]) {
    if (result.error) throw new Error(`Falha ao ler o perfil: ${result.error.message}`);
  }

  // Padrão conservador caso falte alguma linha de privacidade.
  const privacyMap = Object.fromEntries(PROFILE_SECTIONS.map((section) => [section, "private"])) as Record<
    ProfileSection,
    Visibility
  >;
  for (const row of z.array(privacySchema).parse(privacy.data)) privacyMap[row.section] = row.visibility;

  return {
    profile: profileSchema.parse(profile.data),
    periods: z.array(periodSchema).parse(periods.data),
    social: social.data ? socialSchema.parse(social.data) : null,
    emails: emails.data ? emailsSchema.parse(emails.data) : null,
    phone: phone.data ? phoneSchema.parse(phone.data) : null,
    address: address.data ? addressSchema.parse(address.data) : null,
    professional: professional.data ? professionalSchema.parse(professional.data) : null,
    education: z.array(educationSchema).parse(education.data),
    privacy: privacyMap,
  };
}

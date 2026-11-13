"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { requireActiveMember } from "@/lib/auth/session";
import { fieldErrorsFrom, type FormState } from "@/lib/form";
import { createClient } from "@/lib/supabase/server";

import {
  addressSchema,
  basicsSchema,
  educationSchema,
  emailsSchema,
  phoneSchema,
  professionalSchema,
  periodSchema,
  periodsOverlap,
  rowIdSchema,
  sectionVisibilitySchema,
  socialSchema,
  type ProfileSection,
  type Visibility,
} from "./schemas";

/**
 * Edição do próprio perfil. Toda ação usa o id de quem está logado, nunca um
 * id vindo do formulário; a RLS recusa qualquer escrita em linha alheia.
 */

const SAVED: FormState = { status: "success", message: "Salvo." };
const FAILED: FormState = {
  status: "error",
  message: "Não foi possível salvar. Recarregue a página e tente de novo.",
};

function read(formData: FormData, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, String(formData.get(name) ?? "")]));
}

function invalid(error: z.ZodError, values: Record<string, string>): FormState {
  return { status: "error", fieldErrors: fieldErrorsFrom(error), values };
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function setVisibility(supabase: Client, memberId: string, section: ProfileSection, visibility: Visibility) {
  const { error } = await supabase
    .from("profile_privacy")
    .update({ visibility })
    .eq("member_id", memberId)
    .eq("section", section);
  return error;
}

/** Grava uma seção 1:1 (insere ou atualiza) e a sua visibilidade. */
async function saveSection(
  table: string,
  section: ProfileSection,
  row: Record<string, unknown>,
  visibility: Visibility,
): Promise<FormState> {
  const member = await requireActiveMember();
  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .upsert({ member_id: member.id, ...row, updated_at: new Date().toISOString() }, { onConflict: "member_id" });
  if (error) return FAILED;
  if (await setVisibility(supabase, member.id, section, visibility)) return FAILED;
  revalidatePath("/perfil");
  return SAVED;
}

export async function saveBasics(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const values = read(formData, [
    "fullName",
    "displayName",
    "nickname",
    "bio",
    "originCity",
    "originState",
    "originCountry",
    "currentCity",
    "currentCountry",
  ]);
  const showOnPublicPortal = formData.get("showOnPublicPortal") === "on";
  const parsed = basicsSchema.safeParse({ ...values, showOnPublicPortal });
  if (!parsed.success) return invalid(parsed.error, values);
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: data.fullName,
      display_name: data.displayName,
      nickname: data.nickname,
      bio: data.bio,
      origin_city: data.originCity,
      origin_state: data.originState,
      origin_country: data.originCountry,
      current_city: data.currentCity,
      current_country: data.currentCountry,
      show_on_public_portal: data.showOnPublicPortal,
    })
    .eq("member_id", member.id);
  if (error) return FAILED;
  revalidatePath("/", "layout");
  return SAVED;
}

/** Um período de residência a mais. Uma pessoa pode ter vários. */
export async function addPeriod(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const values = read(formData, ["startedOn", "endedOn"]);
  const parsed = periodSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("residency_periods")
    .select("started_on, ended_on")
    .eq("member_id", member.id);
  if (readError) return FAILED;

  const month = (date: string | null) => (date ? date.slice(0, 7) : null);
  const overlaps = (existing ?? []).some((row) =>
    periodsOverlap(parsed.data, { startedOn: String(row.started_on).slice(0, 7), endedOn: month(row.ended_on) }),
  );
  if (overlaps) {
    return {
      status: "error",
      fieldErrors: { startedOn: "Este período se sobrepõe a outro já cadastrado." },
      values,
    };
  }

  const { error } = await supabase.from("residency_periods").insert({
    member_id: member.id,
    started_on: `${parsed.data.startedOn}-01`,
    ended_on: parsed.data.endedOn ? `${parsed.data.endedOn}-01` : null,
  });
  if (error) {
    return error.code === "23514"
      ? { status: "error", message: "Confira o período: há um limite de 12 e as datas não podem ser futuras.", values }
      : FAILED;
  }
  revalidatePath("/perfil");
  return { status: "success", message: "Período adicionado." };
}

export async function deletePeriod(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const parsed = rowIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return FAILED;
  const supabase = await createClient();
  const { error } = await supabase
    .from("residency_periods")
    .delete()
    .eq("id", parsed.data.id)
    .eq("member_id", member.id);
  if (error) return FAILED;
  revalidatePath("/perfil");
  return { status: "success", message: "Período removido." };
}

export async function saveSocial(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = read(formData, ["linkedin", "instagram", "facebook", "x", "github", "other", "visibility"]);
  const parsed = socialSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  const data = parsed.data;
  return saveSection(
    "profile_social",
    "social",
    {
      linkedin_url: data.linkedin,
      instagram_url: data.instagram,
      facebook_url: data.facebook,
      x_url: data.x,
      github_url: data.github,
      other_url: data.other,
    },
    data.visibility,
  );
}

export async function saveEmails(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = read(formData, ["officialEmail", "visibility"]);
  const parsed = emailsSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  return saveSection("profile_emails", "emails", { official_email: parsed.data.officialEmail }, parsed.data.visibility);
}

export async function savePhone(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = read(formData, ["phone", "whatsapp", "visibility"]);
  const parsed = phoneSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  return saveSection(
    "profile_phone",
    "phone",
    { phone: parsed.data.phone, whatsapp: parsed.data.whatsapp },
    parsed.data.visibility,
  );
}

export async function saveAddress(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = read(formData, [
    "street",
    "complement",
    "district",
    "city",
    "state",
    "postalCode",
    "country",
    "visibility",
  ]);
  const parsed = addressSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  const data = parsed.data;
  return saveSection(
    "profile_address",
    "address",
    {
      street: data.street,
      complement: data.complement,
      district: data.district,
      city: data.city,
      state: data.state,
      postal_code: data.postalCode,
      country: data.country,
    },
    data.visibility,
  );
}

export async function saveProfessional(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = read(formData, [
    "company",
    "jobTitle",
    "field",
    "websiteUrl",
    "pitch",
    "skills",
    "visibility",
  ]);
  const parsed = professionalSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  const data = parsed.data;
  return saveSection(
    "profile_professional",
    "professional",
    {
      company: data.company,
      job_title: data.jobTitle,
      field: data.field,
      website_url: data.websiteUrl,
      pitch: data.pitch,
      skills: data.skills,
    },
    data.visibility,
  );
}

export async function addEducation(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const values = read(formData, ["course", "institution", "startYear", "endYear", "completion"]);
  const parsed = educationSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.from("education").insert({
    member_id: member.id,
    course: parsed.data.course,
    institution: parsed.data.institution,
    start_year: parsed.data.startYear,
    end_year: parsed.data.endYear,
    completion: parsed.data.completion,
  });
  if (error) return FAILED;
  revalidatePath("/perfil");
  return { status: "success", message: "Formação adicionada." };
}

export async function deleteEducation(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const parsed = rowIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return FAILED;

  const supabase = await createClient();
  const { error } = await supabase
    .from("education")
    .delete()
    .eq("id", parsed.data.id)
    .eq("member_id", member.id);
  if (error) return FAILED;
  revalidatePath("/perfil");
  return { status: "success", message: "Formação removida." };
}

/** Visibilidade de uma seção sem formulário próprio (formação e, depois, foto). */
export async function saveSectionVisibility(_previous: FormState, formData: FormData): Promise<FormState> {
  const member = await requireActiveMember();
  const parsed = sectionVisibilitySchema.safeParse({
    section: formData.get("section"),
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) return FAILED;
  const supabase = await createClient();
  if (await setVisibility(supabase, member.id, parsed.data.section, parsed.data.visibility)) return FAILED;
  revalidatePath("/perfil");
  return SAVED;
}

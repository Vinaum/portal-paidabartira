import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const MEMBER_BUCKET = "member-media";
const PUBLIC_BUCKET = "public-media";

export type SiteContent = { history: string | null; contactEmail: string | null; housePhotoPath: string | null; housePhotoUrl: string | null };

const settingRow = z.object({ key: z.string(), value: z.unknown() });

/** Textos e foto da casa, editáveis em /admin/conteudo. Só chaves públicas chegam a visitantes (RLS). */
export async function getSiteContent(): Promise<SiteContent> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("republic_settings")
    .select("key, value")
    .in("key", ["republic.history", "republic.contact_email", "republic.house_photo"]);
  const map = new Map(z.array(settingRow).parse(data ?? []).map((row) => [row.key, typeof row.value === "string" && row.value.trim() ? row.value : null]));
  const path = map.get("republic.house_photo") ?? null;
  return {
    history: map.get("republic.history") ?? null,
    contactEmail: map.get("republic.contact_email") ?? null,
    housePhotoPath: path,
    housePhotoUrl: path ? supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl : null,
  };
}

const personRow = z.object({
  member_id: z.uuid(),
  display_name: z.string(),
  nickname: z.string().nullable(),
  bio: z.string().nullable(),
  category: z.enum(["atual_morador", "ex_morador"]),
  is_founder: z.boolean(),
  photo_path: z.string().nullable(),
});
export type PublicPerson = {
  id: string;
  name: string;
  nickname: string | null;
  bio: string | null;
  category: "atual_morador" | "ex_morador";
  isFounder: boolean;
  photoUrl: string | null;
};

/** Pessoas que autorizaram aparecer no portal público (a função do banco aplica as regras). */
export async function listPublicPeople(): Promise<PublicPerson[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_people");
  if (error) throw new Error(`Falha ao ler as pessoas: ${error.message}`);
  const rows = z.array(personRow).parse(data ?? []);
  const paths = rows.map((row) => row.photo_path).filter((path): path is string => Boolean(path));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(MEMBER_BUCKET).createSignedUrls(paths, 3600);
    for (const item of signed ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return rows.map((row) => ({
    id: row.member_id,
    name: row.display_name,
    nickname: row.nickname,
    bio: row.bio,
    category: row.category,
    isFounder: row.is_founder,
    photoUrl: row.photo_path ? (urls.get(row.photo_path) ?? null) : null,
  }));
}

const statsRow = z.object({ current_residents: z.number(), former_residents: z.number(), founders: z.number() });
export async function getHouseStats() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_house_stats");
  if (error) throw new Error(`Falha ao ler os números: ${error.message}`);
  const row = statsRow.parse((data ?? [])[0] ?? { current_residents: 0, former_residents: 0, founders: 0 });
  return { currentResidents: row.current_residents, formerResidents: row.former_residents, founders: row.founders };
}

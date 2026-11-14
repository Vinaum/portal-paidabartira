import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const MUSEUM_BUCKET = "museum-media";

export type AlbumSummary = {
  id: string;
  title: string;
  description: string | null;
  year: number | null;
  visibility: "public" | "members";
  isHidden: boolean;
  createdBy: string | null;
  photoCount: number;
  coverUrl: string | null;
};

export type AlbumPhoto = {
  id: string;
  uploadedBy: string;
  url: string | null;
  caption: string | null;
  isHidden: boolean;
  hiddenReason: string | null;
};

export type AlbumDetail = Omit<AlbumSummary, "photoCount" | "coverUrl"> & {
  hiddenReason: string | null;
  creatorName: string | null;
  photos: AlbumPhoto[];
};

const photoRow = z.object({
  id: z.uuid(),
  uploaded_by: z.uuid(),
  path: z.string(),
  caption: z.string().nullable(),
  is_hidden: z.boolean(),
  hidden_reason: z.string().nullable(),
  created_at: z.string(),
});

const albumRow = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  year: z.number().nullable(),
  visibility: z.enum(["public", "members"]),
  is_hidden: z.boolean(),
  hidden_reason: z.string().nullable(),
  created_by: z.uuid().nullable(),
  album_photos: z.array(photoRow),
});

const COLUMNS =
  "id, title, description, year, visibility, is_hidden, hidden_reason, created_by, album_photos(id, uploaded_by, path, caption, is_hidden, hidden_reason, created_at)";

/** A RLS já filtrou o que quem consulta pode ver; aqui só assinamos as URLs. */
async function sign(paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const { data } = await createAdminClient().storage.from(MUSEUM_BUCKET).createSignedUrls(paths, 3600);
  for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  return urls;
}

const byDate = (a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at);

export async function listAlbums(): Promise<AlbumSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("albums")
    .select(COLUMNS)
    .order("year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Falha ao ler os álbuns: ${error.message}`);
  const rows = z.array(albumRow).parse(data ?? []);
  const covers = rows.map((row) => [...row.album_photos].filter((photo) => !photo.is_hidden).sort(byDate)[0]?.path);
  const urls = await sign(covers.filter((path): path is string => Boolean(path)));
  return rows.map((row, index) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    year: row.year,
    visibility: row.visibility,
    isHidden: row.is_hidden,
    createdBy: row.created_by,
    photoCount: row.album_photos.filter((photo) => !photo.is_hidden).length,
    coverUrl: covers[index] ? (urls.get(covers[index]) ?? null) : null,
  }));
}

export async function getAlbum(id: string, withCreatorName: boolean): Promise<AlbumDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("albums").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao ler o álbum: ${error.message}`);
  if (!data) return null;
  const row = albumRow.parse(data);
  const photos = [...row.album_photos].sort(byDate);
  const urls = await sign(photos.map((photo) => photo.path));
  let creatorName: string | null = null;
  if (withCreatorName && row.created_by) {
    const { data: names } = await supabase.rpc("member_names", { p_ids: [row.created_by] });
    creatorName = (names as { display_name: string }[] | null)?.[0]?.display_name ?? null;
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    year: row.year,
    visibility: row.visibility,
    isHidden: row.is_hidden,
    hiddenReason: row.hidden_reason,
    createdBy: row.created_by,
    creatorName,
    photos: photos.map((photo) => ({
      id: photo.id,
      uploadedBy: photo.uploaded_by,
      url: urls.get(photo.path) ?? null,
      caption: photo.caption,
      isHidden: photo.is_hidden,
      hiddenReason: photo.hidden_reason,
    })),
  };
}

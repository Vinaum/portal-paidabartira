import "server-only";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const STORY_BUCKET = "story-media";

const storyRow = z.object({
  id: z.uuid(),
  author_id: z.uuid(),
  title: z.string(),
  body: z.string(),
  era: z.string().nullable(),
  is_hidden: z.boolean(),
  hidden_reason: z.string().nullable(),
  created_at: z.string(),
  story_photos: z.array(z.object({ id: z.uuid(), path: z.string(), position: z.number() })),
});

export type Story = {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  era: string | null;
  isHidden: boolean;
  hiddenReason: string | null;
  createdAt: string;
  photos: { id: string; url: string | null; position: number }[];
};

export type StoryComment = { id: string; authorId: string; authorName: string; body: string; createdAt: string };

const COLUMNS = "id, author_id, title, body, era, is_hidden, hidden_reason, created_at, story_photos(id, path, position)";

async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.rpc("member_names", { p_ids: unique });
  return new Map((data ?? []).map((row: { id: string; display_name: string }) => [row.id, row.display_name]));
}

async function build(rows: z.infer<typeof storyRow>[]): Promise<Story[]> {
  const paths = rows.flatMap((row) => row.story_photos.map((photo) => photo.path));
  const urls = new Map<string, string>();
  if (paths.length > 0) {
    const { data } = await createAdminClient().storage.from(STORY_BUCKET).createSignedUrls(paths, 3600);
    for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  const names = await namesFor(rows.map((row) => row.author_id));
  return rows.map((row) => ({
    id: row.id,
    authorId: row.author_id,
    authorName: names.get(row.author_id) ?? "Integrante",
    title: row.title,
    body: row.body,
    era: row.era,
    isHidden: row.is_hidden,
    hiddenReason: row.hidden_reason,
    createdAt: row.created_at,
    photos: [...row.story_photos]
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({ id: photo.id, url: urls.get(photo.path) ?? null, position: photo.position })),
  }));
}

/** Histórias que a RLS libera para quem consulta (ocultas só para o autor e a moderação). */
export async function listStories(limit = 50): Promise<Story[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("stories").select(COLUMNS).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(`Falha ao ler as histórias: ${error.message}`);
  return build(z.array(storyRow).parse(data ?? []));
}

export async function getStory(id: string): Promise<Story | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("stories").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Falha ao ler a história: ${error.message}`);
  return data ? (await build([storyRow.parse(data)]))[0] ?? null : null;
}

export async function listComments(storyId: string): Promise<StoryComment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("story_comments")
    .select("id, author_id, body, created_at")
    .eq("story_id", storyId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(`Falha ao ler os comentários: ${error.message}`);
  const rows = z.array(z.object({ id: z.uuid(), author_id: z.uuid(), body: z.string(), created_at: z.string() })).parse(data ?? []);
  const names = await namesFor(rows.map((row) => row.author_id));
  return rows.map((row) => ({
    id: row.id,
    authorId: row.author_id,
    authorName: names.get(row.author_id) ?? "Integrante",
    body: row.body,
    createdAt: row.created_at,
  }));
}

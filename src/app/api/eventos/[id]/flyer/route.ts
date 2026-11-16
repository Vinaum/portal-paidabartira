import { z } from "zod";

import { EVENT_BUCKET } from "@/features/eventos/flyer";
import { readPublicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const notFound = () => new Response("Não encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Entrega o flyer de um evento. Quem pode ver é decidido pela RLS da tabela
 * `events`, com a sessão de quem pede (visitante ou integrante): se a linha do
 * evento não volta, a imagem também não. O arquivo em si vem do bucket privado,
 * lido com a chave de servidor só depois dessa conferência.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/eventos/[id]/flyer">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success || !readPublicEnv()) return notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("visibility, status, flyer_path")
    .eq("id", id)
    .maybeSingle();
  if (error || !data?.flyer_path) return notFound();

  const file = await createAdminClient().storage.from(EVENT_BUCKET).download(data.flyer_path);
  if (file.error || !file.data) return notFound();

  // Só evento público e publicado pode ficar em cache compartilhado (CDN).
  const shared = data.visibility === "public" && data.status !== "draft";
  return new Response(file.data, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": shared ? "public, max-age=300" : "private, max-age=300",
    },
  });
}

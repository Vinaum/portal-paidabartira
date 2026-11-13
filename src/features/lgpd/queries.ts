import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({ id: z.uuid(), status: z.enum(["open", "in_progress", "done", "rejected"]), created_at: z.string() });

/** Pedido de exclusão ainda em andamento do próprio integrante, se houver. */
export async function getOpenDeletionRequest(memberId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_requests")
    .select("id, status, created_at")
    .eq("member_id", memberId)
    .eq("kind", "deletion")
    .in("status", ["open", "in_progress"])
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler o pedido de exclusão: ${error.message}`);
  return data ? requestSchema.parse(data) : null;
}

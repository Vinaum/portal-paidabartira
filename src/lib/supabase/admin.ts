import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { requirePublicEnv } from "@/lib/env";

/**
 * ÚNICO ponto do projeto que lê a chave secreta do Supabase.
 *
 * Este cliente ignora a RLS. Só pode ser usado para as operações que o
 * Supabase exige com privilégio de servidor:
 *   1. enviar convite (auth.admin.inviteUserByEmail);
 *   2. bloquear ou desbloquear conta no Auth (suspensão);
 *   3. excluir conta (pedido do titular), incluindo apagar os arquivos da
 *      pessoa no storage.
 * Quem chama deve ANTES conferir a permissão do usuário logado
 * (`requirePermission`) e registrar a operação em auditoria.
 * Nunca use este cliente para ler ou gravar tabelas da aplicação.
 */
export function createAdminClient() {
  const { supabaseUrl } = requirePublicEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY não definida. Ela existe apenas no servidor (veja .env.example).",
    );
  }
  return createSupabaseClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

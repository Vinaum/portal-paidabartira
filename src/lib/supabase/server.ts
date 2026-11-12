import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { requirePublicEnv } from "@/lib/env";

/**
 * Cliente Supabase ligado aos cookies de quem fez a requisição.
 * Toda consulta feita com ele passa pela RLS com a identidade do usuário.
 * Crie um cliente novo a cada requisição; nunca compartilhe entre requisições.
 */
export async function createClient() {
  // cookies() vem primeiro: marca a renderização como dinâmica, para que
  // nada daqui rode durante a pré-renderização do build.
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseKey } = requirePublicEnv();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components não podem gravar cookies. A renovação da
          // sessão é feita no proxy.ts, então é seguro ignorar aqui.
        }
      },
    },
  });
}

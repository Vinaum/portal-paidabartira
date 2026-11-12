/**
 * Leitura centralizada das variáveis de ambiente.
 * As duas variáveis públicas podem ir ao navegador; a chave secreta é lida
 * apenas em `lib/supabase/admin.ts`, que importa `server-only`.
 */
export type PublicEnv = { supabaseUrl: string; supabaseKey: string };

export function readPublicEnv(): PublicEnv | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return { supabaseUrl, supabaseKey };
}

export function requirePublicEnv(): PublicEnv {
  const env = readPublicEnv();
  if (!env) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (veja .env.example).",
    );
  }
  return env;
}

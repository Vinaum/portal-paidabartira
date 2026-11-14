/** Prefixos de rota que exigem sessão. Fonte única para proxy e testes. */
export const PROTECTED_PREFIXES = [
  "/painel",
  "/diretorio",
  "/perfil",
  "/agenda",
  "/financeiro",
  "/pedidos",
  "/historias",
  "/admin",
] as const;

export const DEFAULT_AFTER_LOGIN = "/painel";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Aceita apenas caminhos internos como destino de redirecionamento.
 * Bloqueia URLs absolutas, "//host", barras invertidas e caracteres de controle,
 * que permitiriam mandar o usuário para outro site depois do login.
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN,
): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes("\\")) return fallback;
  for (const char of next) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return fallback;
  }
  return next;
}

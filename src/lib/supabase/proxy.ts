import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { readPublicEnv } from "@/lib/env";
import { isProtectedPath } from "@/lib/routes";

/**
 * Renova a sessão (cookies) e faz a primeira barreira de rotas: quem não tem
 * sessão válida não chega às áreas restritas.
 *
 * Esta é só a primeira de três camadas. A checagem de status e de permissão
 * acontece nos layouts de servidor, e a RLS do banco decide em definitivo.
 */
export async function updateSession(request: NextRequest) {
  const env = readPublicEnv();
  const { pathname, search } = request.nextUrl;

  if (!env) {
    // Sem Supabase configurado não há como validar sessão: áreas restritas
    // ficam fechadas e o portal público continua no ar.
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims() valida a assinatura do token; não confie em getSession() aqui.
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  if (!isAuthenticated && isProtectedPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}

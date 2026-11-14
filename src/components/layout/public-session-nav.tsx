"use client";

import { useEffect, useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { CartLink } from "@/features/loja/components/cart-icon";

type Session = { loggedIn: boolean; cartCount: number };

/**
 * "Entrar" ou "Meu painel + carrinho" no cabeçalho público. A página é pré-renderizada, então o
 * estado da sessão vem de /api/sessao depois de carregar; até lá aparece "Entrar", igual ao HTML.
 */
export function PublicSessionNav() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    function load() {
      fetch("/api/sessao", { cache: "no-store" })
        .then((response) => (response.ok ? (response.json() as Promise<Session>) : null))
        .then((data) => {
          if (active && data) setSession(data);
        })
        .catch(() => undefined);
    }
    load();
    // Ao voltar para a aba (por exemplo, depois de entrar em outra aba), confere de novo.
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, []);

  if (!session?.loggedIn) {
    return (
      <ButtonLink href="/login" variant="dark">
        Entrar
      </ButtonLink>
    );
  }
  return (
    <>
      <ButtonLink href="/painel" variant="dark">
        Meu painel
      </ButtonLink>
      <CartLink count={session.cartCount} />
    </>
  );
}

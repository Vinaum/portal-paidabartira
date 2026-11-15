import Link from "next/link";
import { Suspense } from "react";

import { foundedYear, site } from "@/config/site";

import { LogoSeal } from "./logo-seal";
import { NavLink, NavMenu, type NavItem } from "./nav-menu";
import { PublicSessionNav } from "./public-session-nav";

const ABOUT: NavItem[] = [
  { href: "/moradores", label: "Moradores" },
  { href: "/museu", label: "Museu" },
  { href: "/comunicados", label: "Comunicados" },
  { href: "/eventos", label: "Eventos" },
];

const linkClass = "font-semibold underline-offset-4 hover:underline";

/** Mesmo desenho do menu, sem destaque da página atual: ocupa o lugar até o menu carregar. */
function PublicNavFallback() {
  return (
    <>
      <Link href="/moradores" className={linkClass}>
        A República <span aria-hidden="true" className="text-xs">▼</span>
      </Link>
      <Link href="/vagas" className={linkClass}>
        Vagas
      </Link>
      <Link href="/caixinha" className={linkClass}>
        Caixinha
      </Link>
      <Link href="/loja" className={linkClass}>
        Loja
      </Link>
    </>
  );
}

export function PublicHeader() {
  return (
    <header className="border-b-4 border-preto bg-creme">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <LogoSeal size={56} />
          <span>
            <span className="block font-display text-2xl font-bold leading-none text-preto">
              {site.name}
            </span>
            <span className="rotulo whitespace-nowrap text-sepia-escuro">República · desde {foundedYear()}</span>
          </span>
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
          {/* usePathname (destaque da página atual) pede Suspense em páginas pré-renderizadas. */}
          <Suspense fallback={<PublicNavFallback />}>
            <NavMenu label="A República" items={ABOUT} />
            <NavLink href="/vagas">Vagas</NavLink>
            <NavLink href="/caixinha">Caixinha</NavLink>
            <NavLink href="/loja">Loja</NavLink>
          </Suspense>
          <PublicSessionNav />
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-16 bg-preto text-creme">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-lg">
          República {site.name} · {foundedYear()}
        </p>
        <nav aria-label="Rodapé" className="flex gap-5">
          <Link href="/ex-moradores" className="underline-offset-4 hover:underline">
            Quem já passou por aqui
          </Link>
          <Link href="/solicitar-acesso" className="underline-offset-4 hover:underline">
            Solicitar acesso
          </Link>
          <Link href="/privacidade" className="underline-offset-4 hover:underline">
            Privacidade
          </Link>
        </nav>
      </div>
    </footer>
  );
}

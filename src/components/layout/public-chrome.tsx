import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { foundedYear, site } from "@/config/site";

import { LogoSeal } from "./logo-seal";

export function PublicHeader() {
  return (
    <header className="border-b-4 border-preto bg-creme">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <LogoSeal size={56} />
          <span>
            <span className="block font-display text-2xl font-bold leading-none text-preto">
              {site.name}
            </span>
            <span className="rotulo text-sepia-escuro">República · desde {foundedYear()}</span>
          </span>
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
          <Link href="/moradores" className="font-semibold underline-offset-4 hover:underline">
            Moradores
          </Link>
          <Link href="/caixinha" className="font-semibold underline-offset-4 hover:underline">
            Caixinha
          </Link>
          <Link href="/loja" className="font-semibold underline-offset-4 hover:underline">
            Loja
          </Link>
          <Link href="/comunicados" className="font-semibold underline-offset-4 hover:underline">
            Comunicados
          </Link>
          <Link href="/eventos" className="font-semibold underline-offset-4 hover:underline">
            Eventos
          </Link>
          <ButtonLink href="/login" variant="dark">
            Entrar
          </ButtonLink>
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

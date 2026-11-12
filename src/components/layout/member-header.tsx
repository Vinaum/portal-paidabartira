import Link from "next/link";

import { SignOutButton } from "@/features/auth/components/sign-out-button";
import type { CurrentMember } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/permissions";
import { site } from "@/config/site";

import { LogoSeal } from "./logo-seal";

/** Cabeçalho das áreas restritas. Os atalhos dependem das permissões. */
export function MemberHeader({ member, area }: { member: CurrentMember; area: "membros" | "admin" }) {
  return (
    <header className="bg-preto text-creme">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/painel" className="flex items-center gap-3">
          <LogoSeal size={44} />
          <span>
            <span className="block font-display text-xl font-bold leading-none">{site.name}</span>
            <span className="rotulo text-papel">
              {area === "admin" ? "Administração" : "Área de integrantes"}
            </span>
          </span>
        </Link>
        <nav aria-label="Área restrita" className="flex flex-wrap items-center gap-4">
          <Link href="/painel" className="font-semibold underline-offset-4 hover:underline">
            Painel
          </Link>
          {canAccessAdmin(member.permissions) ? (
            <Link href="/admin" className="font-semibold underline-offset-4 hover:underline">
              Administração
            </Link>
          ) : null}
          <span className="hidden text-papel sm:inline">{member.displayName}</span>
          <SignOutButton variant="dark" />
        </nav>
      </div>
    </header>
  );
}

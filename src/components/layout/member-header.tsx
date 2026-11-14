import Link from "next/link";
import { Suspense } from "react";

import { CartIcon, CartIndicator } from "@/features/loja/components/cart-indicator";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import type { CurrentMember } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/permissions";
import { site } from "@/config/site";

import { LogoSeal } from "./logo-seal";
import { NavLink, NavMenu, type NavItem } from "./nav-menu";

const COMMUNITY: NavItem[] = [
  { href: "/agenda", label: "Agenda" },
  { href: "/historias", label: "Histórias" },
  { href: "/museu", label: "Museu" },
  { href: "/diretorio", label: "Membros" },
];
const SHOP: NavItem[] = [
  { href: "/loja", label: "Ver a loja" },
  { href: "/pedidos", label: "Meus pedidos" },
];
const ACCOUNT: NavItem[] = [{ href: "/perfil", label: "Meu perfil" }];

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
        <nav aria-label="Área restrita" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <NavLink href="/painel">Painel</NavLink>
          <NavMenu label="A República" items={COMMUNITY} />
          <NavMenu label="Loja" items={SHOP} />
          <NavLink href="/financeiro">Caixinha</NavLink>
          {canAccessAdmin(member.permissions) ? <NavLink href="/admin">Administração</NavLink> : null}
          <NavMenu label={member.displayName} items={ACCOUNT} align="right">
            <SignOutButton variant="outline" />
          </NavMenu>
          <Suspense fallback={<CartIcon level={0} />}>
            <CartIndicator />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

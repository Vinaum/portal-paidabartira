import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { MemberHeader } from "@/components/layout/member-header";
import { requireActiveMember } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false } };

export default function MembersLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<p className="p-6">Carregando…</p>}>
      <MembersGate>{children}</MembersGate>
    </Suspense>
  );
}

/**
 * Segunda camada de proteção (a primeira é o proxy, a terceira é a RLS).
 * Cada página repete `requireActiveMember()` ao buscar dados, porque um
 * layout sozinho não é barreira suficiente.
 */
async function MembersGate({ children }: { children: ReactNode }) {
  const member = await requireActiveMember();
  return (
    <>
      <MemberHeader member={member} area="membros" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
    </>
  );
}

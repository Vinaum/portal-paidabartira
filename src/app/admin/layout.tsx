import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { MemberHeader } from "@/components/layout/member-header";
import { requireAdminAccess } from "@/lib/auth/session";

export const metadata: Metadata = { robots: { index: false } };

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<p className="p-6">Carregando…</p>}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

/** Exige ao menos uma permissão administrativa. Cada seção confere a sua. */
async function AdminGate({ children }: { children: ReactNode }) {
  const member = await requireAdminAccess();
  return (
    <>
      <MemberHeader member={member} area="admin" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
    </>
  );
}

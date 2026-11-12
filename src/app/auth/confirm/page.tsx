import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LogoSeal } from "@/components/layout/logo-seal";
import { ConfirmLinkForm } from "@/features/auth/components/confirm-link-form";
import { site } from "@/config/site";

export const metadata: Metadata = { title: "Confirmar acesso", robots: { index: false } };

/**
 * Destino dos links de e-mail (convite, recuperação de senha, troca de e-mail).
 * Os modelos de e-mail do Supabase apontam para cá; veja docs/supabase.md.
 */
export default function ConfirmPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Link href="/" className="flex flex-col items-center gap-2 text-center">
        <LogoSeal size={88} />
        <span className="font-display text-2xl font-bold">{site.name}</span>
      </Link>
      <div className="flex flex-col gap-4 rounded-sm border border-sepia bg-papel p-6">
        <h1 className="text-3xl font-semibold">Confirmar acesso</h1>
        <Suspense fallback={<p>Lendo o link…</p>}>
          <ConfirmLinkForm />
        </Suspense>
      </div>
    </main>
  );
}

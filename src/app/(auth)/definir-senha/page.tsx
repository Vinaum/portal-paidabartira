import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Notice } from "@/components/ui/notice";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Definir senha" };

export default function SetPasswordPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">Definir senha</h1>
      <Suspense fallback={<p>Verificando seu link…</p>}>
        <SetPasswordGate />
      </Suspense>
    </div>
  );
}

/** Só quem chegou por um link válido (convite ou recuperação) vê o formulário. */
async function SetPasswordGate() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <>
        <Notice tone="error">
          Para definir a senha, abra o link enviado por e-mail. Ele pode ter expirado.
        </Notice>
        <p>
          <Link href="/recuperar-senha" className="font-semibold underline">
            Pedir um novo link
          </Link>
        </p>
      </>
    );
  }
  return (
    <>
      <p>
        Conta: <strong>{user.email ?? "e-mail não informado"}</strong>
      </p>
      <SetPasswordForm />
    </>
  );
}

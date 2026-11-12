import type { Metadata } from "next";
import Link from "next/link";

import { PasswordResetForm } from "@/features/auth/components/password-reset-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function PasswordResetPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">Recuperar senha</h1>
      <p>Informe seu e-mail de login. Enviaremos um link para definir uma nova senha.</p>
      <PasswordResetForm />
      <p>
        <Link href="/login" className="font-semibold underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}

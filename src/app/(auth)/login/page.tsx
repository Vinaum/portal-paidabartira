import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold">Entrar</h1>
      <p>Área restrita a integrantes aprovados da república.</p>
      <Suspense fallback={<p>Carregando formulário…</p>}>
        <LoginForm />
      </Suspense>
      <p>
        <Link href="/recuperar-senha" className="font-semibold underline">
          Esqueci minha senha
        </Link>
      </p>
    </div>
  );
}

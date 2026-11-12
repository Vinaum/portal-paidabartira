import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { Stamp } from "@/components/ui/seal";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

export const metadata: Metadata = { title: "Conta sem acesso", robots: { index: false } };

export default function SuspendedPage() {
  return (
    <Card className="mx-auto flex max-w-xl flex-col items-start gap-4">
      <Stamp>Acesso suspenso</Stamp>
      <h1 className="text-3xl font-semibold">Sua conta está sem acesso à área restrita</h1>
      <p>
        O acesso desta conta foi suspenso ou desativado pela administração da república. Se
        acredita que é um engano, fale com um administrador.
      </p>
      <SignOutButton />
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { Notice } from "@/components/ui/notice";

import { confirmEmailLink } from "../actions";
import { initialFormState } from "../schemas";
import { SubmitButton } from "./submit-button";

export function ConfirmLinkForm() {
  const [state, formAction] = useActionState(confirmEmailLink, initialFormState);
  const params = useSearchParams();
  const tokenHash = params.get("token_hash") ?? "";
  const type = params.get("type") ?? "";

  if (!tokenHash || !type || state.status === "error") {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="error">
          {state.message ?? "Este link está incompleto. Abra novamente o link recebido por e-mail."}
        </Notice>
        <p>
          <Link href="/recuperar-senha" className="font-semibold underline">
            Pedir um novo link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input type="hidden" name="type" value={type} />
      <p>Confirme para continuar com o acesso ao portal.</p>
      <SubmitButton pendingLabel="Confirmando…">Continuar</SubmitButton>
    </form>
  );
}

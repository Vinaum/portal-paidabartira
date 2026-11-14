"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Copia o PIX "copia e cola". Sem permissão do navegador, o texto continua selecionável acima. */
export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }
  return (
    <span className="inline-flex items-center gap-3">
      <Button type="button" variant="outline" onClick={copy}>
        Copiar código PIX
      </Button>
      <span role="status" className="text-sm font-semibold">
        {state === "copied" ? "Copiado!" : state === "failed" ? "Não deu para copiar: selecione o texto." : ""}
      </span>
    </span>
  );
}

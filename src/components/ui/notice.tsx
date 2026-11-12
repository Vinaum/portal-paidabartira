import type { ReactNode } from "react";

type Tone = "info" | "success" | "error";

const tones: Record<Tone, string> = {
  info: "border-sepia bg-papel text-preto",
  success: "border-verde bg-papel text-preto",
  error: "border-vinho bg-papel text-vinho",
};

/** Aviso em linha. Erros são anunciados de imediato a leitores de tela. */
export function Notice({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-sm border-l-4 px-4 py-3 ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

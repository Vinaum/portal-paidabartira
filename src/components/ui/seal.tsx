import type { ReactNode } from "react";

type SealTone = "verde" | "preto" | "vinho";

const tones: Record<SealTone, string> = {
  verde: "border-verde text-verde",
  preto: "border-preto text-preto",
  vinho: "border-vinho text-vinho",
};

/** Selo: categoria, papel e atributo fundador aparecem assim, não como "tags". */
export function Seal({ children, tone = "verde" }: { children: ReactNode; tone?: SealTone }) {
  return (
    <span
      className={`rotulo inline-flex items-center rounded-full border-2 px-3 py-0.5 font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Carimbo: status (de evento, de conta), levemente inclinado. */
export function Stamp({ children, tone = "vinho" }: { children: ReactNode; tone?: SealTone }) {
  return (
    <span
      className={`rotulo inline-block -rotate-2 border-2 border-dashed px-2 py-0.5 font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

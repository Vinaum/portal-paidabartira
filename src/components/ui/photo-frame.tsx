import type { ReactNode } from "react";

/**
 * Moldura de álbum: borda clara, sombra única e legenda datilografada.
 * `tilt` aplica a rotação máxima permitida pela identidade (2 graus).
 */
export function PhotoFrame({
  children,
  caption,
  tilt = "none",
}: {
  children: ReactNode;
  caption: string;
  tilt?: "left" | "right" | "none";
}) {
  const rotation = tilt === "left" ? "-rotate-2" : tilt === "right" ? "rotate-2" : "";
  return (
    <figure className={`bg-creme p-3 pb-2 shadow-foto ${rotation}`.trim()}>
      <div className="aspect-[4/3] overflow-hidden bg-papel">{children}</div>
      <figcaption className="rotulo mt-2 text-center text-sepia-escuro">{caption}</figcaption>
    </figure>
  );
}

/** Espaço reservado, claramente identificado, enquanto não há foto real. */
export function PhotoPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center border border-dashed border-sepia p-4 text-center">
      <span className="rotulo text-sepia-escuro">[{label}]</span>
    </div>
  );
}

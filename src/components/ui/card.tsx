import type { ReactNode } from "react";

/** Superfície de papel envelhecido com borda sépia. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-sm border border-sepia bg-papel p-6 ${className}`.trim()}>
      {children}
    </div>
  );
}

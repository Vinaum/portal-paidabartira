import Link from "next/link";

import { cartLevel } from "../cart-lines";

/** Altura do que "enche" a cestinha, de 0 (vazia) a 3 (cheia). */
const FILL: Record<number, { y: number; height: number } | null> = {
  0: null,
  1: { y: 11, height: 3 },
  2: { y: 8.5, height: 5.5 },
  3: { y: 6, height: 8 },
};

export function CartIcon({ level }: { level: number }) {
  const fill = FILL[level] ?? null;
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {fill ? <rect x="7.6" y={fill.y} width="10" height={fill.height} fill="currentColor" stroke="none" opacity="0.85" /> : null}
      <path d="M2.5 3.5h3l2.3 11h10.4l2-8.2H6.2" />
      <circle cx="9.5" cy="19" r="1.5" />
      <circle cx="16.5" cy="19" r="1.5" />
    </svg>
  );
}

/** Link do carrinho com ícone e contador (sem dependência de servidor). */
export function CartLink({ count }: { count: number }) {
  const label = count === 0 ? "Carrinho vazio" : `Carrinho, ${count} ${count === 1 ? "item" : "itens"}`;
  return (
    <Link href="/carrinho" prefetch={false} aria-label={label} title={label} className="relative inline-flex items-center rounded-sm p-1 hover:opacity-80">
      <CartIcon level={cartLevel(count)} />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-preto bg-creme px-1 text-xs font-bold text-preto"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

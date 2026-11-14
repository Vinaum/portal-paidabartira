"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type NavItem = { href: string; label: string };

const linkClass = "font-semibold underline-offset-4 hover:underline";

/** Link simples do menu; destaca a página atual. */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const current = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={`${linkClass} ${current ? "underline" : ""}`}>
      {children}
    </Link>
  );
}

/**
 * Menu suspenso por botão (padrão "disclosure"): abre com clique ou Enter, fecha com Esc,
 * clique fora, troca de página ou foco que sai do menu. Os itens são links comuns.
 */
export function NavMenu({
  label,
  items,
  children,
  align = "left",
}: {
  label: string;
  items: NavItem[];
  /** Conteúdo extra no fim da lista (ex.: botão Sair). */
  children?: ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const active = items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  // Troca de página fecha o menu (sem efeito: compara a rota em que ele foi aberto).
  const isOpen = open && openedAt === pathname;

  useEffect(() => {
    if (!isOpen) return;
    function onPointer(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        root.current?.querySelector("button")?.focus();
      }
    }
    function onFocusOut(event: FocusEvent) {
      const next = event.relatedTarget as Node | null;
      if (next && root.current && !root.current.contains(next)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    const node = root.current;
    node?.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      node?.removeEventListener("focusout", onFocusOut);
    };
  }, [isOpen]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => {
          setOpen(!isOpen);
          setOpenedAt(pathname);
        }}
        className={`${linkClass} inline-flex items-center gap-1 ${active ? "underline" : ""}`}
      >
        {label}
        <span aria-hidden="true" className="text-xs">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>
      {isOpen ? (
        <ul
          id={panelId}
          className={`absolute top-full z-20 mt-2 flex min-w-48 flex-col gap-1 rounded-sm border-2 border-preto bg-creme p-2 text-preto shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item) => {
            const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`block rounded-sm px-3 py-2 font-semibold hover:bg-papel ${current ? "bg-papel underline" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
          {children ? <li className="border-t border-sepia pt-2">{children}</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

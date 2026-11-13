import Link from "next/link";

import { Stamp } from "@/components/ui/seal";

import type { EventRow } from "../queries";
import { STATUS_LABELS } from "../schemas";
import { eventDayParts, formatEventWhen } from "../time";

/** Cartão de evento. `href` vazio mostra sem link (página pública). */
export function EventCard({ event, href, showStatus = false }: { event: EventRow; href?: string; showStatus?: boolean }) {
  const { day, month } = eventDayParts(event.starts_at);
  const cancelled = event.status === "cancelled";
  const body = (
    <>
      <span
        aria-hidden="true"
        className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-sm border-2 border-sepia bg-creme font-display"
      >
        <span className="text-2xl font-bold leading-none">{day}</span>
        <span className="rotulo text-sepia-escuro">{month}</span>
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className={`text-xl font-semibold leading-tight ${cancelled ? "line-through" : ""}`}>{event.title}</span>
        <span className="text-sepia-escuro">{formatEventWhen(event.starts_at, event.ends_at)}</span>
        {event.location ? <span>{event.location}</span> : null}
        <span className="flex flex-wrap gap-2">
          {cancelled ? <Stamp>Cancelado</Stamp> : null}
          {showStatus && event.status === "draft" ? <Stamp tone="preto">{STATUS_LABELS.draft}</Stamp> : null}
          {showStatus && event.visibility === "public" && event.status !== "draft" ? (
            <Stamp tone="verde">Público</Stamp>
          ) : null}
        </span>
      </span>
    </>
  );
  const className = "flex gap-4 rounded-sm border border-sepia bg-papel p-4";
  return href ? (
    <Link href={href} className={`${className} hover:border-preto`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

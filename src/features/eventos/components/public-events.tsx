import Link from "next/link";

import { Notice } from "@/components/ui/notice";

import { listEvents } from "../queries";
import { EventCard } from "./event-card";

/** Próximos eventos públicos na página inicial. Some se não houver nenhum. */
export async function HomeUpcomingEvents() {
  const events = await listEvents({ scope: "upcoming", publicOnly: true, limit: 3 });
  if (events.length === 0) return null;
  return (
    <>
      <ul className="flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id}>
            <EventCard event={event} />
          </li>
        ))}
      </ul>
      <p>
        <Link href="/eventos" className="font-semibold underline">
          Ver todos os eventos
        </Link>
      </p>
    </>
  );
}

/** Lista completa da página pública de eventos. */
export async function PublicEventsList() {
  const events = await listEvents({ scope: "upcoming", publicOnly: true });
  if (events.length === 0) return <Notice>Nenhum evento público marcado por enquanto.</Notice>;
  return (
    <ul className="flex flex-col gap-3">
      {events.map((event) => (
        <li key={event.id} className="flex flex-col gap-2">
          <EventCard event={event} />
          {event.description ? <p className="whitespace-pre-line pl-2">{event.description}</p> : null}
        </li>
      ))}
    </ul>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { EventCard } from "@/features/eventos/components/event-card";
import { listEvents } from "@/features/eventos/queries";
import { requireActiveMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  await requireActiveMember();
  const { passados } = await searchParams;
  const past = passados === "1";
  const events = await listEvents({ scope: past ? "past" : "upcoming" });

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Área de integrantes" title={past ? "Eventos passados" : "Agenda"} />
      <nav aria-label="Período" className="flex gap-5">
        <Link href="/agenda" aria-current={past ? undefined : "page"} className={past ? "underline" : "font-bold underline"}>
          Próximos
        </Link>
        <Link href="/agenda?passados=1" aria-current={past ? "page" : undefined} className={past ? "font-bold underline" : "underline"}>
          Passados
        </Link>
      </nav>

      {events.length === 0 ? (
        <Notice>{past ? "Nenhum evento passado." : "Nenhum evento marcado por enquanto."}</Notice>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard event={event} href={`/agenda/${event.id}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { EventCard } from "@/features/eventos/components/event-card";
import { listEvents } from "@/features/eventos/queries";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Eventos" };

export default async function AdminEventsPage({ searchParams }: PageProps<"/admin/eventos">) {
  await requirePermission(PERMISSIONS.eventsManage);
  const { apagado } = await searchParams;
  const [upcoming, past] = await Promise.all([
    listEvents({ scope: "upcoming", includeDrafts: true }),
    listEvents({ scope: "past", includeDrafts: true, limit: 20 }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading as="h1" kicker="Administração" title="Eventos" />
        <ButtonLink href="/admin/eventos/novo">Novo evento</ButtonLink>
      </div>
      {apagado === "1" ? <Notice tone="success">Rascunho apagado.</Notice> : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Próximos</h2>
        {upcoming.length === 0 ? (
          <Notice>Nenhum evento à frente. Crie o primeiro.</Notice>
        ) : (
          <ul className="flex flex-col gap-3">
            {upcoming.map((event) => (
              <li key={event.id}>
                <EventCard event={event} href={`/admin/eventos/${event.id}`} showStatus />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Já aconteceram</h2>
          <ul className="flex flex-col gap-3">
            {past.map((event) => (
              <li key={event.id}>
                <EventCard event={event} href={`/admin/eventos/${event.id}`} showStatus />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

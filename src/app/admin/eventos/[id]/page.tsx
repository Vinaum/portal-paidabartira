import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { DeleteDraftForm } from "@/features/eventos/components/delete-draft-form";
import { EventForm } from "@/features/eventos/components/event-form";
import { countGoing, getAttendees, getEvent } from "@/features/eventos/queries";
import { RSVP_LABELS } from "@/features/eventos/schemas";
import { toLocalInput } from "@/features/eventos/time";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Editar evento" };

export default async function EditEventPage({ params, searchParams }: PageProps<"/admin/eventos/[id]">) {
  await requirePermission(PERMISSIONS.eventsManage);
  const { id } = await params;
  const { criado } = await searchParams;
  const event = await getEvent(id);
  if (!event) notFound();
  const attendees = await getAttendees(event.id);

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href="/admin/eventos" className="font-semibold underline">
          ← Eventos
        </Link>
      </p>
      <SectionHeading as="h1" kicker="Administração" title={event.title} />
      {criado === "1" ? (
        <Notice tone="success">
          {event.status === "draft"
            ? "Evento criado como rascunho. Quando estiver pronto, mude a situação para Publicado."
            : "Evento criado."}
        </Notice>
      ) : null}
      <Card>
        <EventForm
          event={{
            id: event.id,
            title: event.title,
            description: event.description ?? "",
            location: event.location ?? "",
            startsAt: toLocalInput(event.starts_at),
            endsAt: event.ends_at ? toLocalInput(event.ends_at) : "",
            visibility: event.visibility,
            status: event.status,
          }}
        />
      </Card>

      {event.status !== "draft" ? (
        <p>
          <Link href={`/agenda/${event.id}`} className="font-semibold underline">
            Ver como integrante
          </Link>
        </p>
      ) : null}

      <Card className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Confirmações</h2>
        {attendees.length === 0 ? (
          <p>Ninguém respondeu ainda.</p>
        ) : (
          <>
            <p>{countGoing(attendees)} confirmados (contando acompanhantes).</p>
            <ul className="flex flex-col gap-1">
              {attendees.map((a) => (
                <li key={a.member_id}>
                  {a.display_name}: {RSVP_LABELS[a.answer]}
                  {a.answer === "going" && a.guests > 0 ? ` (+${a.guests})` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {event.status === "draft" ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Apagar</h2>
          <p>Só rascunhos podem ser apagados. Um evento publicado se cancela, para manter o registro.</p>
          <DeleteDraftForm eventId={event.id} />
        </Card>
      ) : null}
    </div>
  );
}

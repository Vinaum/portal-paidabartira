import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Seal, Stamp } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { RsvpForm } from "@/features/eventos/components/rsvp-form";
import { countGoing, getAttendees, getEvent, getMyRsvp } from "@/features/eventos/queries";
import { RSVP_LABELS } from "@/features/eventos/schemas";
import { formatEventWhen, isPast } from "@/features/eventos/time";
import { requireActiveMember } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Evento" };

export default async function EventPage({ params }: PageProps<"/agenda/[id]">) {
  const member = await requireActiveMember();
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const [mine, attendees] = await Promise.all([getMyRsvp(event.id, member.id), getAttendees(event.id)]);
  const cancelled = event.status === "cancelled";
  const over = isPast(event.starts_at, event.ends_at);
  const open = event.status === "published" && !over;
  const going = attendees.filter((a) => a.answer === "going");
  const maybe = attendees.filter((a) => a.answer === "maybe");

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href="/agenda" className="font-semibold underline">
          ← Agenda
        </Link>
      </p>
      <SectionHeading as="h1" kicker="Evento" title={event.title} />
      <div className="flex flex-wrap gap-2">
        {cancelled ? <Stamp>Cancelado</Stamp> : null}
        {over && !cancelled ? <Stamp tone="preto">Já aconteceu</Stamp> : null}
        {event.visibility === "public" ? <Seal>Público</Seal> : <Seal tone="preto">Só integrantes</Seal>}
      </div>

      <Card className="flex flex-col gap-3">
        <p className="text-xl first-letter:uppercase">{formatEventWhen(event.starts_at, event.ends_at)}</p>
        {event.location ? <p>{event.location}</p> : null}
        {event.description ? <p className="whitespace-pre-line">{event.description}</p> : null}
        {member.permissions.includes(PERMISSIONS.eventsManage) ? (
          <p>
            <Link href={`/admin/eventos/${event.id}`} className="font-semibold underline">
              Editar evento
            </Link>
          </p>
        ) : null}
      </Card>

      {cancelled ? <Notice tone="error">Este evento foi cancelado.</Notice> : null}

      {open ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Sua presença</h2>
          <RsvpForm eventId={event.id} current={mine} />
        </Card>
      ) : mine ? (
        <Notice>Sua resposta: {RSVP_LABELS[mine.answer]}.</Notice>
      ) : null}

      {!cancelled ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Quem vai</h2>
          {attendees.length === 0 ? (
            <p>Ninguém respondeu ainda.</p>
          ) : (
            <>
              <p>
                {countGoing(attendees)} {countGoing(attendees) === 1 ? "pessoa confirmada" : "pessoas confirmadas"}
                {maybe.length > 0 ? `, ${maybe.length} em dúvida` : ""}.
              </p>
              <ul className="flex flex-wrap gap-2">
                {going.map((a) => (
                  <li key={a.member_id}>
                    <Seal>{a.guests > 0 ? `${a.display_name} +${a.guests}` : a.display_name}</Seal>
                  </li>
                ))}
                {maybe.map((a) => (
                  <li key={a.member_id}>
                    <Seal tone="preto">{`${a.display_name} (talvez)`}</Seal>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      ) : null}
    </div>
  );
}

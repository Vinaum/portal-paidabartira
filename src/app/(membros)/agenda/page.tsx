import type { Metadata } from "next";
import Link from "next/link";

import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { BirthdayCard } from "@/features/aniversarios/components/birthday-card";
import { dayInBrasilia, upcomingBirthdays } from "@/features/aniversarios/dates";
import { listBirthdays } from "@/features/aniversarios/queries";
import { EventCard } from "@/features/eventos/components/event-card";
import { listEvents } from "@/features/eventos/queries";
import { requireActiveMember } from "@/lib/auth/session";
import { todayInBrasilia } from "@/lib/format";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  await requireActiveMember();
  const { passados } = await searchParams;
  const past = passados === "1";
  const events = await listEvents({ scope: past ? "past" : "upcoming" });
  const today = todayInBrasilia();
  // Aniversários dos próximos 90 dias entram na lista, intercalados por data.
  const birthdays = past ? [] : upcomingBirthdays(await listBirthdays(), today, 90);
  const items = [
    ...events.map((event) => ({ kind: "event" as const, date: dayInBrasilia(event.starts_at), event })),
    ...birthdays.map((birthday) => ({ kind: "birthday" as const, date: birthday.date, birthday })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "event" ? -1 : 1));

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

      {items.length === 0 ? (
        <Notice>{past ? "Nenhum evento passado." : "Nenhum evento marcado por enquanto."}</Notice>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) =>
            item.kind === "event" ? (
              <li key={item.event.id}>
                <EventCard event={item.event} href={`/agenda/${item.event.id}`} />
              </li>
            ) : (
              <li key={`b-${item.birthday.memberId}`}>
                <BirthdayCard birthday={item.birthday} today={today} />
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

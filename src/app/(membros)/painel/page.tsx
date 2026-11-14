import type { Metadata } from "next";
import { Suspense } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Seal } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { BirthdayCard } from "@/features/aniversarios/components/birthday-card";
import { upcomingBirthdays } from "@/features/aniversarios/dates";
import { listBirthdays } from "@/features/aniversarios/queries";
import { AnnouncementCard } from "@/features/comunicados/components/announcement-card";
import { listAnnouncements } from "@/features/comunicados/queries";
import { AdminPending, FundsSummary, MyOrdersSummary, ProfileChecklist, RecentStories } from "@/features/painel/components/dashboard-blocks";
import { EventCard } from "@/features/eventos/components/event-card";
import { listEvents } from "@/features/eventos/queries";
import { requireActiveMember } from "@/lib/auth/session";
import { todayInBrasilia } from "@/lib/format";
import { CATEGORY_LABELS, ROLE_LABELS, canAccessAdmin } from "@/lib/permissions";

export const metadata: Metadata = { title: "Painel" };

/**
 * Painel do integrante: vínculo, pendências (para quem administra), checklist do
 * perfil, agenda, aniversários, comunicados e resumos de caixinha, pedidos e histórias.
 */
export default async function DashboardPage() {
  const member = await requireActiveMember();
  const today = todayInBrasilia();
  const [nextEvents, announcements, allBirthdays] = await Promise.all([
    listEvents({ scope: "upcoming", limit: 3 }),
    listAnnouncements(3),
    listBirthdays(),
  ]);
  const birthdays = upcomingBirthdays(allBirthdays, today, 30).slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading as="h1" kicker="Boas-vindas" title={`Olá, ${member.displayName}`} />

      <Card className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold">Seu vínculo</h2>
        <div className="flex flex-wrap gap-2">
          <Seal>{CATEGORY_LABELS[member.category]}</Seal>
          {member.isFounder ? <Seal tone="vinho">Fundador</Seal> : null}
          {member.role !== "membro" ? <Seal tone="preto">{ROLE_LABELS[member.role]}</Seal> : null}
        </div>
        <p>
          E-mail de login: <strong>{member.email ?? "não informado"}</strong>
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/perfil">Editar meu perfil</ButtonLink>
          <ButtonLink href="/diretorio" variant="outline">
            Ver os membros
          </ButtonLink>
          {canAccessAdmin(member.permissions) ? (
            <ButtonLink href="/admin" variant="dark">
              Abrir administração
            </ButtonLink>
          ) : null}
        </div>
      </Card>

      <Suspense fallback={null}>
        <AdminPending permissions={member.permissions} />
      </Suspense>
      <Suspense fallback={null}>
        <ProfileChecklist memberId={member.id} />
      </Suspense>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Próximos eventos</h2>
          <ButtonLink href="/agenda" variant="outline">
            Ver a agenda
          </ButtonLink>
        </div>
        {nextEvents.length === 0 ? (
          <p>Nenhum evento marcado por enquanto.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {nextEvents.map((event) => (
              <li key={event.id}>
                <EventCard event={event} href={`/agenda/${event.id}`} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {birthdays.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Aniversariantes dos próximos 30 dias</h2>
          <ul className="flex flex-col gap-2">
            {birthdays.map((birthday) => (
              <li key={birthday.memberId}>
                <BirthdayCard birthday={birthday} today={today} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Comunicados</h2>
          <ButtonLink href="/comunicados" variant="outline">
            Ver todos
          </ButtonLink>
        </div>
        {announcements.length === 0 ? (
          <p>Nenhum comunicado no momento.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {announcements.map((announcement) => (
              <li key={announcement.id}>
                <AnnouncementCard announcement={announcement} full={false} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Suspense fallback={null}>
        <FundsSummary />
      </Suspense>
      <Suspense fallback={null}>
        <MyOrdersSummary memberId={member.id} />
      </Suspense>
      <Suspense fallback={<p>Carregando histórias…</p>}>
        <RecentStories />
      </Suspense>
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { AnnouncementCard } from "@/features/comunicados/components/announcement-card";
import { listAnnouncements } from "@/features/comunicados/queries";

export const metadata: Metadata = { title: "Comunicados" };

/** Visitantes leem os públicos; integrantes, todos os vigentes (a RLS decide). */
export default function AnnouncementsPage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Portal" title="Comunicados" />
      <Suspense fallback={<p>Carregando comunicados…</p>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const announcements = await listAnnouncements();
  if (announcements.length === 0) return <Notice>Nenhum comunicado no momento.</Notice>;
  return (
    <ul className="flex flex-col gap-4">
      {announcements.map((announcement) => (
        <li key={announcement.id}>
          <AnnouncementCard announcement={announcement} />
        </li>
      ))}
    </ul>
  );
}

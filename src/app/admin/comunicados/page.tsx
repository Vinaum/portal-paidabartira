import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { AnnouncementCard } from "@/features/comunicados/components/announcement-card";
import { listAnnouncements } from "@/features/comunicados/queries";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Comunicados" };

export default async function AdminAnnouncementsPage({ searchParams }: PageProps<"/admin/comunicados">) {
  await requirePermission(PERMISSIONS.announcementsPublish);
  const { publicado, apagado } = await searchParams;
  const announcements = await listAnnouncements(100);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading as="h1" kicker="Administração" title="Comunicados" />
        <ButtonLink href="/admin/comunicados/novo">Novo comunicado</ButtonLink>
      </div>
      {publicado === "1" ? <Notice tone="success">Comunicado publicado.</Notice> : null}
      {apagado === "1" ? <Notice tone="success">Comunicado apagado.</Notice> : null}
      {announcements.length === 0 ? (
        <Notice>Nenhum comunicado ainda.</Notice>
      ) : (
        <ul className="flex flex-col gap-4">
          {announcements.map((announcement) => (
            <li key={announcement.id}>
              <AnnouncementCard announcement={announcement} href={`/admin/comunicados/${announcement.id}`} full={false} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

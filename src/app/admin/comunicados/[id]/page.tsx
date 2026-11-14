import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { AnnouncementForm, DeleteAnnouncementForm } from "@/features/comunicados/components/announcement-form";
import { getAnnouncement } from "@/features/comunicados/queries";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Editar comunicado" };

export default async function EditAnnouncementPage({ params }: PageProps<"/admin/comunicados/[id]">) {
  await requirePermission(PERMISSIONS.announcementsPublish);
  const { id } = await params;
  const announcement = await getAnnouncement(id);
  if (!announcement) notFound();
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Comunicados" title={announcement.title} />
      <Card>
        <AnnouncementForm
          announcement={{
            id: announcement.id,
            title: announcement.title,
            body: announcement.body,
            visibility: announcement.visibility,
            isPinned: announcement.is_pinned,
            expiresOn: announcement.expires_on ?? "",
          }}
        />
      </Card>
      <Card>
        <DeleteAnnouncementForm announcementId={announcement.id} />
      </Card>
    </div>
  );
}

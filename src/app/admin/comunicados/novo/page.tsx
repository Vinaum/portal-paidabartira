import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { AnnouncementForm } from "@/features/comunicados/components/announcement-form";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Novo comunicado" };

export default async function NewAnnouncementPage() {
  await requirePermission(PERMISSIONS.announcementsPublish);
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Comunicados" title="Novo comunicado" />
      <Card>
        <AnnouncementForm />
      </Card>
    </div>
  );
}

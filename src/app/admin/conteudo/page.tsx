/* eslint-disable @next/next/no-img-element -- endereço público de imagem institucional. */
import type { Metadata } from "next";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { HousePhotoForm, SiteContentForm } from "@/features/portal/components/content-forms";
import { getSiteContent } from "@/features/portal/queries";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Conteúdo do portal" };

export default async function AdminContentPage() {
  await requirePermission(PERMISSIONS.settingsManage);
  const content = await getSiteContent();
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Administração" title="Conteúdo do portal" />
      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Foto da casa</h2>
        {content.housePhotoUrl ? (
          <img src={content.housePhotoUrl} alt="Foto da casa atual" className="max-w-sm rounded-sm border-2 border-sepia" />
        ) : (
          <p>Nenhuma foto enviada.</p>
        )}
        <HousePhotoForm hasPhoto={Boolean(content.housePhotoUrl)} />
      </Card>
      <Card>
        <SiteContentForm history={content.history ?? ""} contactEmail={content.contactEmail ?? ""} />
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { EventForm } from "@/features/eventos/components/event-form";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Novo evento" };

export default async function NewEventPage() {
  await requirePermission(PERMISSIONS.eventsManage);
  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href="/admin/eventos" className="font-semibold underline">
          ← Eventos
        </Link>
      </p>
      <SectionHeading as="h1" kicker="Administração" title="Novo evento" />
      <Card>
        <EventForm />
      </Card>
    </div>
  );
}

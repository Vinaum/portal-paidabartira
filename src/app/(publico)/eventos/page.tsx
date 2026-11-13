import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionHeading } from "@/components/ui/section-heading";
import { PublicEventsList } from "@/features/eventos/components/public-events";

export const metadata: Metadata = { title: "Eventos" };

/** Eventos abertos a qualquer visitante. Os de integrantes ficam na agenda restrita. */
export default function PublicEventsPage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Portal" title="Próximos eventos" />
      <Suspense fallback={<p>Carregando eventos…</p>}>
        <PublicEventsList />
      </Suspense>
    </div>
  );
}

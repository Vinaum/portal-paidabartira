import type { Metadata } from "next";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { AlbumForm } from "@/features/museu/components/museum-forms";
import { requireActiveMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Novo álbum" };

export default function NewAlbumPage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Museu" title="Novo álbum" />
      <Suspense fallback={<p>Carregando…</p>}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  await requireActiveMember();
  return (
    <Card>
      <AlbumForm />
    </Card>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { PeopleGrid } from "@/features/portal/components/people";
import { listPublicPeople } from "@/features/portal/queries";

export const metadata: Metadata = { title: "Moradores" };

export default function ResidentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Pessoas" title="Quem mora aqui" />
      <p className="max-w-prose">
        Aparecem só as pessoas que autorizaram. Cada uma escolhe o que mostrar no perfil.
      </p>
      <Suspense fallback={<p>Carregando moradores…</p>}>
        <Residents />
      </Suspense>
    </div>
  );
}

async function Residents() {
  const people = (await listPublicPeople()).filter((person) => person.category === "atual_morador");
  if (people.length === 0) return <Notice>Nenhum morador atual optou por aparecer aqui ainda.</Notice>;
  return <PeopleGrid people={people} />;
}

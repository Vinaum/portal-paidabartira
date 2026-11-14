import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { PeopleGrid } from "@/features/portal/components/people";
import { listPublicPeople } from "@/features/portal/queries";

export const metadata: Metadata = { title: "Quem já passou por aqui" };

export default function FormerResidentsPage() {
  return (
    <div className="flex flex-col gap-8">
      <SectionHeading as="h1" kicker="Pessoas" title="Quem já passou por aqui" />
      <p className="max-w-prose">
        Fundadores e ex-moradores que autorizaram aparecer. Quem mora hoje está em{" "}
        <Link href="/moradores" className="underline underline-offset-4">
          moradores
        </Link>
        .
      </p>
      <Suspense fallback={<p>Carregando…</p>}>
        <Former />
      </Suspense>
    </div>
  );
}

async function Former() {
  const people = await listPublicPeople();
  const founders = people.filter((person) => person.isFounder);
  const former = people.filter((person) => person.category === "ex_morador" && !person.isFounder);
  if (founders.length === 0 && former.length === 0) {
    return <Notice>Ainda ninguém desta lista optou por aparecer aqui.</Notice>;
  }
  return (
    <>
      {founders.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Fundadores</h2>
          <PeopleGrid people={founders} />
        </section>
      ) : null}
      {former.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Ex-moradores</h2>
          <PeopleGrid people={former} />
        </section>
      ) : null}
    </>
  );
}

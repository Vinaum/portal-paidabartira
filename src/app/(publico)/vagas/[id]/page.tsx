import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { InterestForm } from "@/features/vagas/components/interest-form";
import { VacancyFacts } from "@/features/vagas/components/vacancy-card";
import { getVacancy } from "@/features/vagas/queries";

export const metadata: Metadata = { title: "Vaga" };

export default function VacancyPage({ params }: PageProps<"/vagas/[id]">) {
  return (
    <Suspense fallback={<p>Carregando vaga…</p>}>
      <Vacancy params={params} />
    </Suspense>
  );
}

async function Vacancy({ params }: { params: PageProps<"/vagas/[id]">["params"] }) {
  const { id } = await params;
  const vacancy = await getVacancy(id);
  // Visitantes só recebem vagas abertas (RLS); gestores podem abrir as encerradas.
  if (!vacancy) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <SectionHeading as="h1" kicker="Morar aqui" title={vacancy.title} />
      <p>
        <Link href="/vagas" className="underline underline-offset-4">
          Todas as vagas
        </Link>
      </p>
      <VacancyFacts vacancy={vacancy} />
      <p className="whitespace-pre-line">{vacancy.description}</p>
      {vacancy.status === "open" ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">Tenho interesse</h2>
          <InterestForm vacancyId={vacancy.id} />
        </Card>
      ) : (
        <Notice>Esta vaga foi encerrada.</Notice>
      )}
    </div>
  );
}

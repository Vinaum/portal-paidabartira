import type { Metadata } from "next";
import { Suspense } from "react";

import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { listVacancies } from "@/features/vagas/queries";
import { VacancyCard } from "@/features/vagas/components/vacancy-card";

export const metadata: Metadata = {
  title: "Vagas",
  description: "Vagas abertas para novos moradores da república.",
};

export default function VacanciesPage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Morar aqui" title="Vagas para novos moradores" />
      <p className="max-w-prose">
        Quando abre uma vaga na casa, ela aparece aqui. Deixe o seu interesse e a república entra em contato.
      </p>
      <Suspense fallback={<p>Carregando vagas…</p>}>
        <OpenVacancies />
      </Suspense>
    </div>
  );
}

async function OpenVacancies() {
  const vacancies = (await listVacancies()).filter((vacancy) => vacancy.status === "open");
  if (vacancies.length === 0) {
    return <Notice>Não há vagas abertas no momento. Volte em breve.</Notice>;
  }
  return (
    <ul className="flex flex-col gap-4">
      {vacancies.map((vacancy) => (
        <li key={vacancy.id}>
          <VacancyCard vacancy={vacancy} />
        </li>
      ))}
    </ul>
  );
}

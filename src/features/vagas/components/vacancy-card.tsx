import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Stamp } from "@/components/ui/seal";
import { formatBRL } from "@/features/caixinha/money";
import { formatDate } from "@/lib/format";

import type { Vacancy } from "../queries";

export function VacancyFacts({ vacancy }: { vacancy: Vacancy }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {vacancy.status === "closed" ? <Stamp tone="vinho">Encerrada</Stamp> : null}
      {vacancy.monthly_cents ? <span>Valor mensal: <strong>{formatBRL(vacancy.monthly_cents)}</strong></span> : null}
      {vacancy.available_from ? <span>Disponível a partir de <strong>{formatDate(vacancy.available_from)}</strong></span> : null}
    </p>
  );
}

export function VacancyCard({ vacancy }: { vacancy: Vacancy }) {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold">
        <Link href={`/vagas/${vacancy.id}`} className="underline-offset-4 hover:underline">
          {vacancy.title}
        </Link>
      </h2>
      <VacancyFacts vacancy={vacancy} />
      <p className="line-clamp-3 whitespace-pre-line">{vacancy.description}</p>
      <p>
        <Link href={`/vagas/${vacancy.id}`} className="font-semibold underline underline-offset-4">
          Ver detalhes e demonstrar interesse
        </Link>
      </p>
    </Card>
  );
}

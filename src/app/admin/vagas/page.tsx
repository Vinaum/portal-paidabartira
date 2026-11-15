import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Stamp } from "@/components/ui/seal";
import { centsToInput, formatBRL } from "@/features/caixinha/money";
import {
  DeleteVacancyForm,
  InterestActions,
  VacancyForm,
  VacancyStatusForm,
} from "@/features/vagas/components/vacancy-forms";
import { listInterests, listVacancies } from "@/features/vagas/queries";
import { INTEREST_RETENTION_DAYS, INTEREST_STATUS_LABELS, VACANCY_STATUS_LABELS } from "@/features/vagas/schemas";
import { requirePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Vagas: gestão" };

export default async function AdminVacanciesPage() {
  await requirePermission(PERMISSIONS.vacanciesManage);
  const [vacancies, interests] = await Promise.all([listVacancies(), listInterests()]);

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading as="h1" kicker="Painel administrativo" title="Vagas para novos moradores" />
      <p className="max-w-prose">
        Vagas abertas aparecem na página pública <Link href="/vagas" className="font-semibold underline">/vagas</Link>. Os dados de quem
        demonstra interesse são apagados sozinhos em {INTEREST_RETENTION_DAYS} dias; apague antes quando a conversa terminar.
      </p>

      <section aria-labelledby="nova" className="flex flex-col gap-4">
        <h2 id="nova" className="text-2xl font-semibold">Publicar vaga</h2>
        <Card>
          <VacancyForm defaults={{ vacancyId: "", title: "", description: "", monthly: "", availableFrom: "" }} submitLabel="Publicar vaga" />
        </Card>
      </section>

      <section aria-labelledby="vagas" className="flex flex-col gap-4">
        <h2 id="vagas" className="text-2xl font-semibold">Vagas</h2>
        {vacancies.length === 0 ? <Notice>Nenhuma vaga cadastrada.</Notice> : null}
        {vacancies.map((vacancy) => {
          const received = interests.filter((interest) => interest.vacancy_id === vacancy.id);
          return (
            <Card key={vacancy.id} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-xl font-semibold">{vacancy.title}</h3>
                <Stamp tone={vacancy.status === "open" ? "verde" : "preto"}>{VACANCY_STATUS_LABELS[vacancy.status]}</Stamp>
                {vacancy.monthly_cents ? <span>{formatBRL(vacancy.monthly_cents)}/mês</span> : null}
                <Link href={`/vagas/${vacancy.id}`} className="text-sm font-semibold underline underline-offset-4">
                  Ver página pública
                </Link>
              </div>

              <div>
                <h4 className="mb-2 text-lg font-semibold">Interessados ({received.length})</h4>
                {received.length === 0 ? <p className="text-sm">Ninguém ainda.</p> : null}
                <ul className="flex flex-col divide-y divide-sepia">
                  {received.map((interest) => (
                    <li key={interest.id} className="flex flex-col gap-2 py-3">
                      <p className="flex flex-wrap items-center gap-3">
                        <strong>{interest.name}</strong>
                        <Stamp tone={interest.status === "new" ? "vinho" : "preto"}>{INTEREST_STATUS_LABELS[interest.status]}</Stamp>
                        <span className="text-sm text-sepia-escuro">{formatDate(interest.created_at)}</span>
                      </p>
                      <p className="break-all">
                        <a href={`mailto:${interest.email}`} className="underline underline-offset-4">{interest.email}</a>
                        {interest.phone ? <span> · {interest.phone}</span> : null}
                        {interest.course ? <span> · {interest.course}</span> : null}
                      </p>
                      {interest.message ? <p className="whitespace-pre-line text-sm">{interest.message}</p> : null}
                      <InterestActions interestId={interest.id} status={interest.status} />
                    </li>
                  ))}
                </ul>
              </div>

              <details>
                <summary className="cursor-pointer font-semibold underline-offset-4 hover:underline">Editar vaga</summary>
                <div className="mt-3">
                  <VacancyForm
                    defaults={{
                      vacancyId: vacancy.id,
                      title: vacancy.title,
                      description: vacancy.description,
                      monthly: vacancy.monthly_cents ? centsToInput(vacancy.monthly_cents) : "",
                      availableFrom: vacancy.available_from ?? "",
                    }}
                    submitLabel="Salvar alterações"
                  />
                </div>
              </details>
              <div className="flex flex-wrap items-start gap-4">
                <VacancyStatusForm vacancyId={vacancy.id} open={vacancy.status === "open"} />
                <DeleteVacancyForm vacancyId={vacancy.id} />
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

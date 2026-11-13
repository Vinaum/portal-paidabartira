import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { AddEntryForm, ReverseEntryForm } from "@/features/caixinha/components/entry-forms";
import { FundForm } from "@/features/caixinha/components/fund-form";
import { AddManagerForm, RemoveManagerForm } from "@/features/caixinha/components/manager-forms";
import { centsToInput, formatBRL } from "@/features/caixinha/money";
import { getManagedFund, listEntries, listFundManagers, listMemberOptions } from "@/features/caixinha/queries";
import { requireActiveMember } from "@/lib/auth/session";
import { formatDay, todayInBrasilia } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Gerenciar caixinha" };

export default async function ManageFundPage({ params, searchParams }: PageProps<"/financeiro/[id]/gerenciar">) {
  const member = await requireActiveMember();
  const { id } = await params;
  const { criada } = await searchParams;
  // A RLS só devolve a caixinha a quem pode gerenciá-la (finance.write ou responsável).
  const fund = await getManagedFund(id);
  if (!fund) {
    redirect("/financeiro");
  }
  const isAdmin = member.permissions.includes(PERMISSIONS.financeWrite);
  const [entries, managers, options] = await Promise.all([
    listEntries(id),
    isAdmin ? listFundManagers(id) : Promise.resolve([]),
    isAdmin ? listMemberOptions() : Promise.resolve([]),
  ]);
  const reversedIds = new Set(entries.map((entry) => entry.reverses_id).filter(Boolean));
  const managerIds = new Set(managers.map((manager) => manager.member_id));

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Caixinhas" title={`Gerenciar: ${fund.name}`} />
      <p>
        <Link href={`/financeiro/${id}`} className="underline underline-offset-4">
          Ver como integrante
        </Link>
      </p>
      {criada === "1" ? <Notice tone="success">Caixinha criada. Agora designe responsáveis e registre lançamentos.</Notice> : null}
      {!fund.is_active ? <Notice>Esta caixinha está encerrada e não aceita novos lançamentos.</Notice> : null}

      {fund.is_active ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">Novo lançamento</h2>
          <AddEntryForm fundId={id} today={todayInBrasilia()} />
        </Card>
      ) : null}

      <section aria-labelledby="lancamentos" className="flex flex-col gap-3">
        <h2 id="lancamentos" className="text-2xl font-semibold">
          Lançamentos
        </h2>
        <p className="text-sm text-sepia-escuro">
          Lançamentos não são editados nem apagados. Para corrigir um erro, estorne e registre de novo.
        </p>
        {entries.length === 0 ? (
          <Notice>Nenhum lançamento ainda.</Notice>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((entry) => {
              const isReversal = entry.reverses_id !== null;
              const canReverse = fund.is_active && !isReversal && !reversedIds.has(entry.id);
              return (
                <li key={entry.id} className="flex flex-col gap-2 rounded-sm border border-sepia bg-papel p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>
                      <span className="rotulo mr-2 text-sepia-escuro">{formatDay(entry.occurred_on)}</span>
                      <strong className="mr-2">{entry.kind === "income" ? "Entrada" : "Saída"}</strong>
                      {entry.category ? <span className="mr-2">{entry.category}</span> : null}
                      {entry.description}
                      {isReversal ? <em className="ml-2 text-vinho">(estorno)</em> : null}
                      {reversedIds.has(entry.id) ? <em className="ml-2 text-vinho">(estornado)</em> : null}
                    </span>
                    <span className="font-semibold">{formatBRL(entry.amount_cents)}</span>
                  </div>
                  {canReverse ? <ReverseEntryForm entryId={entry.id} fundId={id} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isAdmin ? (
        <>
          <Card className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">Responsáveis</h2>
            <p>
              Responsáveis registram lançamentos desta caixinha, mas não alteram suas configurações. Administradores
              sempre podem.
            </p>
            {managers.length === 0 ? (
              <p>Nenhum responsável designado.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {managers.map((manager) => (
                  <li key={manager.member_id}>
                    <RemoveManagerForm fundId={id} memberId={manager.member_id} name={manager.display_name} />
                  </li>
                ))}
              </ul>
            )}
            <AddManagerForm fundId={id} options={options.filter((option) => !managerIds.has(option.id))} />
          </Card>

          <Card className="flex flex-col gap-4">
            <h2 className="text-2xl font-semibold">Configurações</h2>
            <FundForm
              fund={{
                id: fund.id,
                name: fund.name,
                description: fund.description ?? "",
                goal: fund.goal_cents ? centsToInput(fund.goal_cents) : "",
                visibility: fund.visibility,
                pixKey: fund.pix_key ?? "",
                pixHolder: fund.pix_holder ?? "",
                pixInstructions: fund.pix_instructions ?? "",
                isActive: fund.is_active,
              }}
            />
          </Card>
        </>
      ) : null}
    </div>
  );
}

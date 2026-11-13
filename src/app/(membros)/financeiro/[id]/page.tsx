import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { FundCard } from "@/features/caixinha/components/fund-views";
import { formatBRL } from "@/features/caixinha/money";
import { getCashflow, getExpenses, getFundOverview, getManagedFund } from "@/features/caixinha/queries";
import { requireActiveMember } from "@/lib/auth/session";
import { formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Caixinha" };

function monthLabel(month: string): string {
  const [year, m] = month.slice(0, 7).split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1]}/${year}`;
}

export default async function FundPage({ params }: PageProps<"/financeiro/[id]">) {
  await requireActiveMember();
  const { id } = await params;
  const fund = await getFundOverview(id);
  if (!fund) notFound();
  const [cashflow, expenses, managed] = await Promise.all([getCashflow(id), getExpenses(id), getManagedFund(id)]);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Caixinhas" title={fund.name} />
      {managed ? (
        <div>
          <ButtonLink href={`/financeiro/${id}/gerenciar`}>Gerenciar</ButtonLink>
        </div>
      ) : null}
      <FundCard fund={fund} showSpent />

      <section aria-labelledby="fluxo" className="flex flex-col gap-3">
        <h2 id="fluxo" className="text-2xl font-semibold">
          Fluxo de caixa por mês
        </h2>
        {cashflow.length === 0 ? (
          <Notice>Ainda não há movimentação.</Notice>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-left">
              <caption className="sr-only">Entradas e saídas por mês</caption>
              <thead>
                <tr className="border-b border-sepia">
                  <th scope="col" className="p-3">Mês</th>
                  <th scope="col" className="p-3 text-right">Entradas</th>
                  <th scope="col" className="p-3 text-right">Saídas</th>
                  <th scope="col" className="p-3 text-right">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {cashflow.map((row) => (
                  <tr key={row.month} className="border-b border-sepia/40">
                    <th scope="row" className="p-3 font-semibold">{monthLabel(row.month)}</th>
                    <td className="p-3 text-right">{formatBRL(row.income_cents)}</td>
                    <td className="p-3 text-right">{formatBRL(row.expense_cents)}</td>
                    <td className="p-3 text-right font-semibold">{formatBRL(row.income_cents - row.expense_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section aria-labelledby="saidas" className="flex flex-col gap-3">
        <h2 id="saidas" className="text-2xl font-semibold">
          Saídas
        </h2>
        {expenses.length === 0 ? (
          <Notice>Nenhuma saída registrada.</Notice>
        ) : (
          <ul className="flex flex-col gap-2">
            {expenses.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-sm border border-sepia bg-papel p-3">
                <span>
                  <span className="rotulo mr-2 text-sepia-escuro">{formatDay(row.occurred_on)}</span>
                  {row.category ? <strong className="mr-2">{row.category}</strong> : null}
                  {row.description}
                  {row.is_reversal ? <em className="ml-2 text-vinho">(estorno)</em> : null}
                </span>
                <span className={row.is_reversal ? "font-semibold text-verde" : "font-semibold"}>
                  {row.is_reversal ? "+" : "−"} {formatBRL(row.amount_cents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

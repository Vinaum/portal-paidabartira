import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { FundCard } from "@/features/caixinha/components/fund-views";
import { listFundOverviews, listManagedFunds } from "@/features/caixinha/queries";
import { requireActiveMember } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Caixinha" };

export default async function FinancePage() {
  const member = await requireActiveMember();
  const canCreate = member.permissions.includes(PERMISSIONS.financeWrite);
  const [funds, managed] = await Promise.all([listFundOverviews(), listManagedFunds()]);
  const managedIds = new Set(managed.map((fund) => fund.id));

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Área de integrantes" title="Caixinhas" />
      <p className="max-w-prose">
        Transparência do dinheiro da república: quanto entrou, em que foi gasto e quanto sobra. Quem contribuiu não é
        identificado em lugar nenhum.
      </p>
      {canCreate ? (
        <div>
          <ButtonLink href="/financeiro/nova">Nova caixinha</ButtonLink>
        </div>
      ) : null}
      {funds.length === 0 ? (
        <Notice>Nenhuma caixinha criada ainda.</Notice>
      ) : (
        <ul className="flex flex-col gap-4">
          {funds.map((fund) => (
            <li key={fund.id} className="flex flex-col gap-2">
              <FundCard fund={fund} href={`/financeiro/${fund.id}`} showSpent />
              {managedIds.has(fund.id) ? (
                <p>
                  <ButtonLink href={`/financeiro/${fund.id}/gerenciar`} variant="outline">
                    Gerenciar lançamentos
                  </ButtonLink>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

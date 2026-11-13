import type { Metadata } from "next";
import { Suspense } from "react";

import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { FundCard } from "@/features/caixinha/components/fund-views";
import { listFundOverviews } from "@/features/caixinha/queries";

export const metadata: Metadata = { title: "Caixinha" };

/** Total arrecadado por caixinha pública. Nunca mostra quem contribuiu. */
export default function PublicCaixinhaPage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Portal" title="Caixinha" />
      <p className="max-w-prose">
        Aqui você acompanha quanto já foi arrecadado em cada caixinha aberta ao público. Quem contribui não é
        identificado. A prestação de contas completa fica na área de integrantes.
      </p>
      <Suspense fallback={<p>Carregando caixinhas…</p>}>
        <PublicFunds />
      </Suspense>
    </div>
  );
}

async function PublicFunds() {
  const funds = (await listFundOverviews()).filter((fund) => fund.visibility === "public" && fund.is_active);
  if (funds.length === 0) return <Notice>Nenhuma caixinha pública aberta no momento.</Notice>;
  return (
    <ul className="flex flex-col gap-4">
      {funds.map((fund) => (
        <li key={fund.id}>
          <FundCard fund={fund} />
        </li>
      ))}
    </ul>
  );
}

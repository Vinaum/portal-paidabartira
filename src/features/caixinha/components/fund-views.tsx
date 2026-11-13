import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Stamp } from "@/components/ui/seal";

import { formatBRL } from "../money";
import type { FundOverview } from "../queries";

export function ProgressBar({ raised, goal }: { raised: number; goal: number }) {
  const percent = Math.min(100, Math.round((raised / goal) * 100));
  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da meta"
        className="h-4 w-full overflow-hidden rounded-sm border-2 border-sepia bg-creme"
      >
        <div className="h-full bg-verde" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-sm text-sepia-escuro">
        {formatBRL(raised)} de {formatBRL(goal)} ({percent}%)
      </p>
    </div>
  );
}

/** PIX para contribuir. A chave só chega aqui se a caixinha estiver ativa. */
export function PixBox({ fund }: { fund: FundOverview }) {
  if (!fund.pix_key) return null;
  return (
    <div className="flex flex-col gap-1 rounded-sm border-2 border-dashed border-sepia bg-creme p-4">
      <p className="rotulo text-sepia-escuro">Como contribuir (PIX)</p>
      <p className="break-all font-mono text-lg">{fund.pix_key}</p>
      {fund.pix_holder ? <p>Favorecido: {fund.pix_holder}</p> : null}
      {fund.pix_instructions ? <p className="whitespace-pre-line text-sm">{fund.pix_instructions}</p> : null}
    </div>
  );
}

/** Cartão de caixinha. Com `href`, vira link para a página de integrantes. */
export function FundCard({ fund, href, showSpent = false }: { fund: FundOverview; href?: string; showSpent?: boolean }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-2xl font-semibold">
          {href ? (
            <Link href={href} className="underline-offset-4 hover:underline">
              {fund.name}
            </Link>
          ) : (
            fund.name
          )}
        </h2>
        <span className="flex gap-2">
          {!fund.is_active ? <Stamp tone="preto">Encerrada</Stamp> : null}
          {fund.visibility === "members" ? <Stamp tone="preto">Só integrantes</Stamp> : null}
        </span>
      </div>
      {fund.description ? <p className="whitespace-pre-line">{fund.description}</p> : null}
      <p className="text-xl">
        <span className="rotulo mr-2 text-sepia-escuro">Arrecadado</span>
        <strong>{formatBRL(fund.raised_cents)}</strong>
      </p>
      {fund.goal_cents ? <ProgressBar raised={fund.raised_cents} goal={fund.goal_cents} /> : null}
      {showSpent && fund.spent_cents !== null && fund.balance_cents !== null ? (
        <p className="text-sepia-escuro">
          Gasto: {formatBRL(fund.spent_cents)} · Saldo: <strong>{formatBRL(fund.balance_cents)}</strong>
        </p>
      ) : null}
      <PixBox fund={fund} />
    </Card>
  );
}

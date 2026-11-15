import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Stamp } from "@/components/ui/seal";
import {
  AddDocumentForm,
  AddEntryForm,
  RemoveDocumentForm,
  ReverseEntryForm,
  SettingsForm,
} from "@/features/associacao/components/association-forms";
import { DocumentsList } from "@/features/associacao/components/association-views";
import { getSettings, getSummary, listDocuments, listLedger } from "@/features/associacao/queries";
import { centsToInput, formatBRL } from "@/features/caixinha/money";
import { requirePermission } from "@/lib/auth/session";
import { formatDate, todayInBrasilia } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Associação: caixa" };

export default async function AdminAssociationCashPage() {
  await requirePermission(PERMISSIONS.associationManage);
  const [summary, ledger, settings, documents] = await Promise.all([getSummary(), listLedger(), getSettings(), listDocuments()]);
  const today = todayInBrasilia();

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading as="h1" kicker="Painel administrativo" title="Associação: caixa, PIX e documentos" />
      <div>
        <ButtonLink href="/admin/associacao" variant="outline">
          Voltar a associados e mensalidades
        </ButtonLink>
      </div>
      {summary ? (
        <p className="text-lg">
          Arrecadado <strong>{formatBRL(summary.raised_cents)}</strong> · gasto <strong>{formatBRL(summary.spent_cents)}</strong> · saldo{" "}
          <strong>{formatBRL(summary.balance_cents)}</strong>
        </p>
      ) : null}

      <section aria-labelledby="pix" className="flex flex-col gap-4">
        <h2 id="pix" className="text-2xl font-semibold">PIX e mensalidade</h2>
        <Card>
          <SettingsForm
            defaults={{
              pixKey: settings?.pix_key ?? "",
              pixHolder: settings?.pix_holder ?? "",
              pixInstructions: settings?.pix_instructions ?? "",
              monthly: settings?.monthly_cents ? centsToInput(settings.monthly_cents) : "",
            }}
          />
        </Card>
      </section>

      <section aria-labelledby="lancar" className="flex flex-col gap-4">
        <h2 id="lancar" className="text-2xl font-semibold">Lançar no livro-caixa</h2>
        <Card>
          <AddEntryForm today={today} />
        </Card>
      </section>

      <section aria-labelledby="livro" className="flex flex-col gap-4">
        <h2 id="livro" className="text-2xl font-semibold">Livro-caixa</h2>
        <p className="max-w-prose text-sm text-sepia-escuro">Lançamentos não se alteram nem se apagam: erros são corrigidos com um estorno.</p>
        {ledger.length === 0 ? <Notice>Nenhum lançamento ainda.</Notice> : null}
        <ul className="flex flex-col divide-y divide-sepia">
          {ledger.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span>
                  <span className="text-sm text-sepia-escuro">{formatDate(row.occurred_on)}</span>
                  {row.category ? <span className="rotulo ml-2 text-sepia-escuro">{row.category}</span> : null}
                  <span className="block">{row.description}</span>
                </span>
                <span className="flex items-center gap-2">
                  {row.reverses_id ? <Stamp tone="preto">Estorno</Stamp> : null}
                  {row.isReversed ? <Stamp tone="vinho">Estornado</Stamp> : null}
                  <strong>
                    {row.kind === "income" ? "+" : "−"} {formatBRL(row.amount_cents)}
                  </strong>
                </span>
              </div>
              {!row.reverses_id && !row.isReversed ? <ReverseEntryForm entryId={row.id} /> : null}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="documentos" className="flex flex-col gap-4">
        <h2 id="documentos" className="text-2xl font-semibold">Documentos</h2>
        <Card>
          <AddDocumentForm today={today} />
        </Card>
        <DocumentsList documents={documents}>{(id) => <RemoveDocumentForm documentId={id} />}</DocumentsList>
      </section>
    </div>
  );
}

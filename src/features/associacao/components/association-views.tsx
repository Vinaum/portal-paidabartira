/* eslint-disable @next/next/no-img-element -- QR gerado na hora (data URL). */
import QRCode from "qrcode";

import { Card } from "@/components/ui/card";
import { Stamp } from "@/components/ui/seal";
import { formatBRL } from "@/features/caixinha/money";
import { CopyButton } from "@/features/loja/components/copy-button";
import { buildPixPayload } from "@/features/loja/pix";
import { formatDate, formatMonthTitle } from "@/lib/format";

import type { AssociationDocument, AssociationSettings, ExpenseRow } from "../queries";
import { DOC_KIND_LABELS } from "../schemas";

export function SummaryCards({ raised, spent, balance, associates }: { raised: number; spent: number; balance: number; associates: number }) {
  const items = [
    ["Arrecadado", formatBRL(raised)],
    ["Gasto", formatBRL(spent)],
    ["Saldo", formatBRL(balance)],
    ["Associados", String(associates)],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([label, value]) => (
        <Card key={label} className="flex flex-col gap-1">
          <dt className="rotulo text-sepia-escuro">{label}</dt>
          <dd className="text-2xl font-semibold">{value}</dd>
        </Card>
      ))}
    </dl>
  );
}

export function CashflowTable({ rows }: { rows: { month: string; income_cents: number; expense_cents: number }[] }) {
  if (rows.length === 0) return <p>Nenhum lançamento ainda.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-96 text-left">
        <caption className="sr-only">Fluxo de caixa por mês</caption>
        <thead>
          <tr className="border-b-2 border-preto">
            <th scope="col" className="py-2 pr-4">Mês</th>
            <th scope="col" className="py-2 pr-4">Entradas</th>
            <th scope="col" className="py-2">Saídas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.month} className="border-b border-sepia">
              <th scope="row" className="py-2 pr-4 font-normal">{formatMonthTitle(row.month)}</th>
              <td className="py-2 pr-4">{formatBRL(row.income_cents)}</td>
              <td className="py-2">{formatBRL(row.expense_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExpensesTable({ rows }: { rows: ExpenseRow[] }) {
  if (rows.length === 0) return <p>Nenhuma saída registrada.</p>;
  return (
    <ul className="flex flex-col divide-y divide-sepia">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
          <span>
            <span className="text-sm text-sepia-escuro">{formatDate(row.occurred_on)}</span>
            {row.category ? <span className="rotulo ml-2 text-sepia-escuro">{row.category}</span> : null}
            <span className="block">{row.description}</span>
          </span>
          <span className="flex items-center gap-2">
            {row.is_reversal ? <Stamp tone="preto">Estorno</Stamp> : null}
            <strong>{row.is_reversal ? "−" : ""}{formatBRL(row.amount_cents)}</strong>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DocumentsList({ documents, children }: { documents: AssociationDocument[]; children?: (id: string) => React.ReactNode }) {
  if (documents.length === 0) return <p>Nenhum documento publicado ainda.</p>;
  return (
    <ul className="flex flex-col divide-y divide-sepia">
      {documents.map((doc) => (
        <li key={doc.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="rotulo text-sepia-escuro">
              {DOC_KIND_LABELS[doc.kind]} · {formatDate(doc.doc_date)}
            </p>
            {doc.url ? (
              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
                {doc.title}
              </a>
            ) : (
              <span className="font-semibold">{doc.title}</span>
            )}
            <span className="ml-2 text-sm text-sepia-escuro">PDF · {(doc.size_bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB</span>
            {doc.description ? <p className="text-sm">{doc.description}</p> : null}
          </div>
          {children ? children(doc.id) : null}
        </li>
      ))}
    </ul>
  );
}

/** Dados do PIX da Associação; com mensalidade sugerida, também o QR code. Sem retorno de pagamento. */
export async function AssociationPix({ settings }: { settings: AssociationSettings }) {
  if (!settings.pix_key) {
    return <p>A tesouraria ainda não cadastrou o PIX da Associação.</p>;
  }
  const payload =
    settings.monthly_cents && settings.pix_holder
      ? buildPixPayload({
          key: settings.pix_key,
          receiver: settings.pix_holder,
          city: "BRASIL",
          amountCents: settings.monthly_cents,
          txid: "PDBASSOC",
        })
      : null;
  const svg = payload ? await QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;
  const dataUrl = svg ? `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` : null;
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {dataUrl && settings.monthly_cents ? (
        <img
          src={dataUrl}
          alt={`QR code do PIX de ${formatBRL(settings.monthly_cents)} para ${settings.pix_holder ?? "a Associação"}`}
          width={200}
          height={200}
          className="h-[200px] w-[200px] shrink-0 rounded-sm border-2 border-preto bg-white"
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="rotulo text-sepia-escuro">PIX da Associação</p>
        <p className="break-all font-mono text-lg">{settings.pix_key}</p>
        {settings.pix_holder ? <p>Favorecido: {settings.pix_holder}</p> : null}
        {settings.monthly_cents ? <p>Mensalidade sugerida: <strong>{formatBRL(settings.monthly_cents)}</strong></p> : null}
        {settings.pix_instructions ? <p className="whitespace-pre-line text-sm">{settings.pix_instructions}</p> : null}
        {payload ? (
          <div>
            <CopyButton text={payload} />
          </div>
        ) : null}
        <p className="text-sm text-sepia-escuro">
          Depois de pagar, use “Já paguei” abaixo. A tesouraria confere o PIX recebido e confirma; não há confirmação automática.
        </p>
      </div>
    </div>
  );
}

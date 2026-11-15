import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { Stamp } from "@/components/ui/seal";
import {
  AssociationPix,
  CashflowTable,
  DocumentsList,
  ExpensesTable,
  SummaryCards,
} from "@/features/associacao/components/association-views";
import { ApplyForm, InformDueForm } from "@/features/associacao/components/association-forms";
import {
  getCashflow,
  getExpenses,
  getMyAssociation,
  getSettings,
  getSummary,
  listDocuments,
  listMyDues,
} from "@/features/associacao/queries";
import { DUE_LABELS } from "@/features/associacao/schemas";
import { centsToInput, formatBRL } from "@/features/caixinha/money";
import { requireActiveMember } from "@/lib/auth/session";
import { formatMonthTitle, todayInBrasilia } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Associação" };

export default async function AssociationPage() {
  const member = await requireActiveMember();
  const isManager = member.permissions.includes(PERMISSIONS.associationManage);
  const mine = await getMyAssociation(member.id);
  const isAssociate = mine?.status === "active";

  if (!isAssociate && !isManager) {
    return (
      <div className="flex flex-col gap-6">
        <SectionHeading as="h1" kicker="Área de integrantes" title="Associação" />
        <p className="max-w-prose">
          A Associação reúne ex-moradores e agregados que apoiam a república com uma mensalidade. Associados acompanham as contas, os
          documentos e as atas.
        </p>
        {member.category === "atual_morador" ? (
          <Notice>Moradores atuais participam como integrantes. Quando você deixar a república, poderá pedir para ser associado.</Notice>
        ) : mine?.status === "pending" ? (
          <Notice>Seu pedido está aguardando a análise da administração.</Notice>
        ) : (
          <Card className="flex flex-col gap-3">
            {mine?.status === "declined" ? <Notice tone="error">Seu último pedido não foi aprovado. Você pode pedir de novo.</Notice> : null}
            {mine?.status === "left" ? <Notice>Seu vínculo com a Associação foi encerrado. Você pode pedir para voltar.</Notice> : null}
            <p>O pedido é analisado pela administração antes de liberar o acesso.</p>
            <ApplyForm />
          </Card>
        )}
      </div>
    );
  }

  const today = todayInBrasilia();
  const currentMonth = today.slice(0, 7);
  const [summary, cashflow, expenses, settings, documents, dues] = await Promise.all([
    getSummary(),
    getCashflow(),
    getExpenses(),
    getSettings(),
    listDocuments(),
    isAssociate ? listMyDues(member.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <SectionHeading as="h1" kicker="Área de integrantes" title="Associação" />
      {isManager ? (
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/admin/associacao" variant="dark">
            Gerenciar associados e mensalidades
          </ButtonLink>
          <ButtonLink href="/admin/associacao/caixa" variant="outline">
            Caixa, PIX e documentos
          </ButtonLink>
        </div>
      ) : null}

      {summary ? (
        <SummaryCards raised={summary.raised_cents} spent={summary.spent_cents} balance={summary.balance_cents} associates={summary.associates} />
      ) : null}

      {isAssociate && settings ? (
        <section aria-labelledby="mensalidade" className="flex flex-col gap-4">
          <h2 id="mensalidade" className="text-2xl font-semibold">Mensalidade</h2>
          <Card className="flex flex-col gap-6">
            <AssociationPix settings={settings} />
            <div className="border-t border-sepia pt-4">
              <h3 className="mb-3 text-xl font-semibold">Avisar que paguei</h3>
              <InformDueForm currentMonth={currentMonth} suggested={settings.monthly_cents ? centsToInput(settings.monthly_cents) : ""} />
            </div>
          </Card>
          {dues.length > 0 ? (
            <ul className="flex flex-col divide-y divide-sepia">
              {dues.map((due) => (
                <li key={due.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  {formatMonthTitle(due.ref_month)}
                  <span className="flex items-center gap-3">
                    {formatBRL(due.amount_cents)}
                    <Stamp tone={due.status === "confirmed" ? "verde" : due.status === "rejected" ? "vinho" : "preto"}>{DUE_LABELS[due.status]}</Stamp>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="contas" className="flex flex-col gap-4">
        <h2 id="contas" className="text-2xl font-semibold">Transparência</h2>
        <p className="max-w-prose text-sm text-sepia-escuro">
          Entradas aparecem somadas por mês; quem contribuiu não é identificado. As saídas aparecem uma a uma.
        </p>
        <CashflowTable rows={cashflow} />
        <h3 className="text-xl font-semibold">Saídas</h3>
        <ExpensesTable rows={expenses} />
      </section>

      <section aria-labelledby="documentos" className="flex flex-col gap-4">
        <h2 id="documentos" className="text-2xl font-semibold">Estatuto, atas e prestação de contas</h2>
        <DocumentsList documents={documents} />
      </section>
    </div>
  );
}

import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Stamp } from "@/components/ui/seal";
import { formatBRL } from "@/features/caixinha/money";
import { listFundOverviews } from "@/features/caixinha/queries";
import { StoryCard } from "@/features/historias/components/story-card";
import { listStories } from "@/features/historias/queries";
import { listMyOrders } from "@/features/loja/queries";
import { ORDER_STATUS_LABELS } from "@/features/loja/schemas";
import type { Permission } from "@/lib/permissions";

import { getAdminPending, getProfileChecklist } from "../queries";

export async function ProfileChecklist({ memberId }: { memberId: string }) {
  const { items, done, total } = await getProfileChecklist(memberId);
  if (done === total) return null;
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold">Complete o seu perfil</h2>
      <p>
        {done} de {total} passos.{" "}
        <Link href="/perfil" className="font-semibold underline underline-offset-4">
          Abrir meu perfil
        </Link>
      </p>
      <div
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Perfil completo"
        className="h-3 w-full overflow-hidden rounded-sm border-2 border-sepia bg-creme"
      >
        <div className="h-full bg-verde" style={{ width: `${Math.round((done / total) * 100)}%` }} />
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className={item.done ? "text-sepia-escuro line-through" : ""}>
            <span aria-hidden="true">{item.done ? "✓ " : "○ "}</span>
            {item.done ? (
              <span>{item.label}</span>
            ) : (
              <Link href={item.href} className="underline underline-offset-4">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export async function AdminPending({ permissions }: { permissions: readonly Permission[] }) {
  const pending = await getAdminPending(permissions);
  if (pending.length === 0) return null;
  const total = pending.reduce((sum, item) => sum + item.count, 0);
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold">Pendências de administração</h2>
      {total === 0 ? (
        <p>Nada pendente por enquanto.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending
            .filter((item) => item.count > 0)
            .map((item) => (
              <li key={item.href} className="flex items-center justify-between gap-3">
                <Link href={item.href} className="underline underline-offset-4">
                  {item.label}
                </Link>
                <Stamp tone="vinho">{item.count}</Stamp>
              </li>
            ))}
        </ul>
      )}
    </Card>
  );
}

export async function FundsSummary() {
  const funds = (await listFundOverviews()).filter((fund) => fund.is_active);
  if (funds.length === 0) return null;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Caixinhas</h2>
        <Link href="/financeiro" className="font-semibold underline underline-offset-4">
          Ver detalhes
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {funds.map((fund) => (
          <li key={fund.id} className="flex flex-wrap items-baseline justify-between gap-2">
            <Link href={`/financeiro/${fund.id}`} className="underline underline-offset-4">
              {fund.name}
            </Link>
            <span>
              Arrecadado <strong>{formatBRL(fund.raised_cents)}</strong>
              {fund.balance_cents !== null ? <> · Saldo <strong>{formatBRL(fund.balance_cents)}</strong></> : null}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export async function MyOrdersSummary({ memberId }: { memberId: string }) {
  const open = (await listMyOrders(memberId)).filter((order) => order.status !== "delivered" && order.status !== "cancelled");
  if (open.length === 0) return null;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Meus pedidos em andamento</h2>
        <Link href="/pedidos" className="font-semibold underline underline-offset-4">
          Ver pedidos
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {open.map((order) => (
          <li key={order.id} className="flex flex-wrap items-baseline justify-between gap-2">
            <span>
              {order.quantity} × {order.product_name}
              {order.size ? ` (${order.size})` : ""}
            </span>
            <Stamp tone="verde">{ORDER_STATUS_LABELS[order.status]}</Stamp>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export async function RecentStories() {
  const stories = (await listStories(3)).filter((story) => !story.isHidden);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Histórias recentes</h2>
        <Link href="/historias" className="font-semibold underline underline-offset-4">
          Ver todas
        </Link>
      </div>
      {stories.length === 0 ? (
        <p>
          Ainda não há histórias.{" "}
          <Link href="/historias/nova" className="font-semibold underline underline-offset-4">
            Conte a primeira
          </Link>
          .
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {stories.map((story) => (
            <li key={story.id}>
              <StoryCard story={story} href={`/historias/${story.id}`} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}


import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Stamp } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatBRL } from "@/features/caixinha/money";
import { CancelOrderForm } from "@/features/loja/components/order-forms";
import { isShopManager, listMyOrders } from "@/features/loja/queries";
import { ORDER_STATUS_LABELS } from "@/features/loja/schemas";
import { requireActiveMember } from "@/lib/auth/session";
import { formatDay } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Meus pedidos" };

export default async function MyOrdersPage({ searchParams }: PageProps<"/pedidos">) {
  const member = await requireActiveMember();
  const { novo } = await searchParams;
  const [orders, canManage] = await Promise.all([
    listMyOrders(member.id),
    isShopManager(member.permissions.includes(PERMISSIONS.storeManage)),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Loja" title="Meus pedidos" />
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/loja" variant="outline">Ver a loja</ButtonLink>
        {canManage ? <ButtonLink href="/pedidos/gestao">Gerenciar loja</ButtonLink> : null}
      </div>
      {novo === "1" ? <Notice tone="success">Pedido enviado. A tesouraria vai confirmar e combinar o pagamento.</Notice> : null}
      {orders.length === 0 ? (
        <Notice>
          Você ainda não fez pedidos. <Link href="/loja" className="font-semibold underline">Veja a loja</Link>.
        </Notice>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-semibold">
                    {order.quantity} × {order.product_name}
                    {order.size ? ` (${order.size})` : ""}
                  </h2>
                  <Stamp tone={order.status === "cancelled" ? "vinho" : "verde"}>{ORDER_STATUS_LABELS[order.status]}</Stamp>
                </div>
                <p>
                  Total: <strong>{formatBRL(order.unit_price_cents * order.quantity)}</strong> · pedido em{" "}
                  {formatDay(order.created_at.slice(0, 10))}
                </p>
                {order.note ? <p>Sua observação: {order.note}</p> : null}
                {order.manager_note ? <p>Recado da tesouraria: {order.manager_note}</p> : null}
                {order.payment_instructions && (order.status === "requested" || order.status === "confirmed") ? (
                  <p className="rounded-sm border-2 border-dashed border-sepia bg-creme p-3 whitespace-pre-line">
                    Como pagar: {order.payment_instructions}
                  </p>
                ) : null}
                {order.status === "requested" ? <CancelOrderForm orderId={order.id} /> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

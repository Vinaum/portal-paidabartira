import type { Metadata } from "next";
import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Stamp } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatBRL } from "@/features/caixinha/money";
import { orderCode } from "@/features/loja/pix";
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
        <ButtonLink href="/carrinho" variant="outline">Carrinho</ButtonLink>
        {canManage ? <ButtonLink href="/pedidos/gestao">Gerenciar loja</ButtonLink> : null}
      </div>
      {novo === "1" ? <Notice tone="success">Pedido enviado.</Notice> : null}
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
                    <Link href={`/pedidos/${order.id}`} className="underline-offset-4 hover:underline">
                      Pedido {orderCode(order.id)}
                    </Link>
                  </h2>
                  <Stamp tone={order.status === "cancelled" ? "vinho" : "verde"}>{ORDER_STATUS_LABELS[order.status]}</Stamp>
                </div>
                <p>
                  {order.shop_order_items.map((item) => `${item.quantity} × ${item.product_name}${item.size ? ` (${item.size})` : ""}`).join(", ")}
                </p>
                <p>
                  Total: <strong>{formatBRL(order.total_cents)}</strong> · pedido em {formatDay(order.created_at.slice(0, 10))}
                </p>
                {order.manager_note ? <p>Recado da tesouraria: {order.manager_note}</p> : null}
                {order.status === "requested" || order.status === "confirmed" ? (
                  <p>
                    <Link href={`/pedidos/${order.id}`} className="font-semibold underline underline-offset-4">
                      Pagar com PIX
                    </Link>
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

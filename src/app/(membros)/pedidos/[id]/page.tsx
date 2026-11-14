import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Stamp } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatBRL } from "@/features/caixinha/money";
import { CancelOrderForm } from "@/features/loja/components/order-forms";
import { PixPanel } from "@/features/loja/components/pix-panel";
import { orderCode } from "@/features/loja/pix";
import { getMyOrder, getShopPix } from "@/features/loja/queries";
import { ORDER_STATUS_LABELS } from "@/features/loja/schemas";
import { requireActiveMember } from "@/lib/auth/session";
import { formatDay } from "@/lib/format";

export const metadata: Metadata = { title: "Pedido" };

export default async function OrderPage({ params, searchParams }: PageProps<"/pedidos/[id]">) {
  const member = await requireActiveMember();
  const { id } = await params;
  const { novo } = await searchParams;
  const order = await getMyOrder(id, member.id);
  if (!order) notFound();
  const payable = order.status === "requested" || order.status === "confirmed";
  const pix = payable ? await getShopPix() : null;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Loja" title={`Pedido ${orderCode(order.id)}`} />
      <p>
        <Link href="/pedidos" className="underline underline-offset-4">
          Voltar aos pedidos
        </Link>
      </p>
      {novo === "1" ? <Notice tone="success">Pedido feito! Pague com o PIX abaixo para a tesouraria conferir.</Notice> : null}
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-semibold">Itens</h2>
          <Stamp tone={order.status === "cancelled" ? "vinho" : "verde"}>{ORDER_STATUS_LABELS[order.status]}</Stamp>
        </div>
        <ul className="flex flex-col gap-1">
          {order.shop_order_items.map((item, index) => (
            <li key={index} className="flex flex-wrap justify-between gap-2">
              <span>
                {item.quantity} × {item.product_name}
                {item.size ? ` (${item.size})` : ""}
              </span>
              <span>{formatBRL(item.unit_price_cents * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xl">
          Total: <strong>{formatBRL(order.total_cents)}</strong> · pedido em {formatDay(order.created_at.slice(0, 10))}
        </p>
        {order.note ? <p>Sua observação: {order.note}</p> : null}
        {order.manager_note ? <p>Recado da tesouraria: {order.manager_note}</p> : null}
        {order.status === "requested" ? <CancelOrderForm orderId={order.id} /> : null}
      </Card>

      {payable ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">Pagar com PIX</h2>
          {pix ? (
            <PixPanel pix={pix} orderId={order.id} totalCents={order.total_cents} />
          ) : (
            <p>A loja ainda não tem PIX configurado. A tesouraria vai combinar o pagamento com você.</p>
          )}
          {order.payment_instructions ? (
            <p className="rounded-sm border-2 border-dashed border-sepia bg-creme p-3 whitespace-pre-line">
              Orientações: {order.payment_instructions}
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

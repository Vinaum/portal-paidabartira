import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Stamp } from "@/components/ui/seal";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatBRL } from "@/features/caixinha/money";
import { orderCode } from "@/features/loja/pix";
import { OrderStatusForm } from "@/features/loja/components/order-forms";
import { ShopPixForm } from "@/features/loja/components/cart-forms";
import { AddShopManagerForm, RemoveShopManagerForm } from "@/features/loja/components/manager-forms";
import { getShopPix, isShopManager, listMemberOptions, listOrders, listShopManagers } from "@/features/loja/queries";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/features/loja/schemas";
import { requireActiveMember } from "@/lib/auth/session";
import { formatDay } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Gerenciar loja" };

export default async function ShopAdminPage({ searchParams }: PageProps<"/pedidos/gestao">) {
  const member = await requireActiveMember();
  const isAdmin = member.permissions.includes(PERMISSIONS.storeManage);
  if (!(await isShopManager(isAdmin))) redirect("/pedidos");
  const { status } = await searchParams;
  const filter = typeof status === "string" && (ORDER_STATUSES as readonly string[]).includes(status) ? status : undefined;
  const [orders, managers, options, pix] = await Promise.all([
    listOrders(filter),
    isAdmin ? listShopManagers() : Promise.resolve([]),
    isAdmin ? listMemberOptions() : Promise.resolve([]),
    isAdmin ? getShopPix() : Promise.resolve(null),
  ]);
  const managerIds = new Set(managers.map((manager) => manager.member_id));

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Loja" title="Gerenciar loja" />
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/pedidos/gestao/produtos">Produtos</ButtonLink>
        <ButtonLink href="/pedidos" variant="outline">Meus pedidos</ButtonLink>
      </div>

      <nav aria-label="Filtrar pedidos" className="flex flex-wrap gap-4">
        <Link href="/pedidos/gestao" className={filter ? "underline" : "font-bold underline"}>Todos</Link>
        {ORDER_STATUSES.map((option) => (
          <Link key={option} href={`/pedidos/gestao?status=${option}`} className={filter === option ? "font-bold underline" : "underline"}>
            {ORDER_STATUS_LABELS[option]}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <Notice>Nenhum pedido.</Notice>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-xl font-semibold">
                    {order.member_name} · {orderCode(order.id)}
                  </h2>
                  <Stamp tone={order.status === "cancelled" ? "vinho" : "verde"}>{ORDER_STATUS_LABELS[order.status]}</Stamp>
                </div>
                <ul className="list-disc pl-6">
                  {order.items.map((item, index) => (
                    <li key={index}>
                      {item.quantity} × {item.product_name}
                      {item.size ? ` (${item.size})` : ""}
                    </li>
                  ))}
                </ul>
                <p>
                  Total: <strong>{formatBRL(order.total_cents)}</strong> · {formatDay(order.created_at.slice(0, 10))}
                </p>
                {order.note ? <p>Observação: {order.note}</p> : null}
                {order.manager_note ? <p>Seu recado: {order.manager_note}</p> : null}
                <OrderStatusForm orderId={order.id} status={order.status} />
              </Card>
            </li>
          ))}
        </ul>
      )}

      {isAdmin ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">PIX da loja</h2>
          <p>
            Uma chave só, usada no QR code de todos os pedidos. Hoje é de uma pessoa; quando existir a Associação,
            troque pela chave dela. {pix ? "QR code ligado." : "QR code desligado."}
          </p>
          <ShopPixForm current={pix} />
        </Card>
      ) : null}

      {isAdmin ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">Responsáveis pela loja</h2>
          <p>Responsáveis cuidam de produtos e pedidos, mas não designam outros responsáveis.</p>
          {managers.length === 0 ? (
            <p>Nenhum responsável designado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {managers.map((manager) => (
                <li key={manager.member_id}>
                  <RemoveShopManagerForm memberId={manager.member_id} name={manager.display_name} />
                </li>
              ))}
            </ul>
          )}
          <AddShopManagerForm options={options.filter((option) => !managerIds.has(option.id))} />
        </Card>
      ) : null}
    </div>
  );
}

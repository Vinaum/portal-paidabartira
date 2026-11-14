/* eslint-disable @next/next/no-img-element -- imagem gerada na hora (data URL). */
import QRCode from "qrcode";

import { formatBRL } from "@/features/caixinha/money";

import { buildPixPayload, orderCode } from "../pix";
import type { ShopPix } from "../queries";

import { CopyButton } from "./copy-button";

/** QR code e "copia e cola" do PIX da loja para um pedido. */
export async function PixPanel({ pix, orderId, totalCents }: { pix: ShopPix; orderId: string; totalCents: number }) {
  if (totalCents <= 0) return null;
  const payload = buildPixPayload({
    key: pix.key,
    receiver: pix.receiver,
    city: pix.city,
    amountCents: totalCents,
    txid: orderCode(orderId),
  });
  const svg = await QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <img
        src={dataUrl}
        alt={`QR code do PIX de ${formatBRL(totalCents)} para ${pix.receiver}`}
        width={220}
        height={220}
        className="h-[220px] w-[220px] shrink-0 rounded-sm border-2 border-preto bg-white"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p>
          Valor: <strong>{formatBRL(totalCents)}</strong> · recebedor: <strong>{pix.receiver}</strong>
        </p>
        <p className="text-sm text-sepia-escuro">
          Abra o app do seu banco, escolha pagar com PIX e leia o QR code ou use o código abaixo. Pague o valor exato.
          Depois, a tesouraria confere o PIX recebido e marca o pedido como pago.
        </p>
        <textarea
          readOnly
          aria-label="Código PIX copia e cola"
          value={payload}
          rows={4}
          className="w-full rounded-sm border-2 border-preto bg-white p-2 font-mono text-xs"
        />
        <div>
          <CopyButton text={payload} />
        </div>
      </div>
    </div>
  );
}

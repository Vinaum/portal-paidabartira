/* eslint-disable @next/next/no-img-element -- endereço assinado e temporário. */
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Stamp } from "@/components/ui/seal";
import { formatBRL } from "@/features/caixinha/money";

import type { Product } from "../queries";

export function ProductPhoto({ product, size = 160 }: { product: Product; size?: number }) {
  return product.photoUrl ? (
    <img
      src={product.photoUrl}
      alt={product.name}
      loading="lazy"
      className="shrink-0 rounded-sm border-2 border-sepia object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-sm border-2 border-dashed border-sepia bg-creme text-sepia-escuro"
      style={{ width: size, height: size }}
    >
      sem foto
    </div>
  );
}

export function ProductCard({ product, href }: { product: Product; href: string }) {
  return (
    <Card className="flex gap-4">
      <ProductPhoto product={product} />
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-2xl font-semibold">
          <Link href={href} className="underline-offset-4 hover:underline">
            {product.name}
          </Link>
        </h2>
        <p className="text-xl font-bold">{formatBRL(product.price_cents)}</p>
        <p className="flex flex-wrap gap-2">
          {!product.is_published ? <Stamp tone="vinho">Rascunho</Stamp> : null}
          {!product.is_available ? <Stamp tone="vinho">Esgotado</Stamp> : null}
          {product.visibility === "members" ? <Stamp tone="preto">Só integrantes</Stamp> : null}
        </p>
        {product.description ? <p className="line-clamp-2 whitespace-pre-line">{product.description}</p> : null}
      </div>
    </Card>
  );
}

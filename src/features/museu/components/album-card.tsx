/* eslint-disable @next/next/no-img-element -- endereço assinado e temporário. */
import Link from "next/link";

import { Card } from "@/components/ui/card";

import type { AlbumSummary } from "../queries";

export function AlbumCard({ album }: { album: AlbumSummary }) {
  return (
    <Card className="flex h-full flex-col gap-3">
      {album.coverUrl ? (
        <img src={album.coverUrl} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-sm border-2 border-sepia object-cover" />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-sm border-2 border-dashed border-sepia text-sepia-escuro">
          Sem fotos ainda
        </div>
      )}
      <h2 className="text-xl font-semibold">
        <Link href={`/museu/${album.id}`} className="underline-offset-4 hover:underline">
          {album.title}
        </Link>
      </h2>
      <p className="rotulo text-sepia-escuro">
        {album.year ? `${album.year} · ` : ""}
        {album.photoCount} {album.photoCount === 1 ? "foto" : "fotos"}
        {album.visibility === "public" ? " · público" : " · só integrantes"}
        {album.isHidden ? " · oculto" : ""}
      </p>
    </Card>
  );
}

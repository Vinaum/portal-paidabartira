/* eslint-disable @next/next/no-img-element -- endereço assinado e temporário. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  AlbumPhotoForm,
  HideMuseumItemForm,
  RemoveAlbumPhotoForm,
} from "@/features/museu/components/museum-forms";
import { getAlbum } from "@/features/museu/queries";
import { getCurrentMember } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Álbum" };

export default function AlbumPage({ params, searchParams }: PageProps<"/museu/[id]">) {
  return (
    <Suspense fallback={<p>Carregando álbum…</p>}>
      <Album params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Album({
  params,
  searchParams,
}: {
  params: PageProps<"/museu/[id]">["params"];
  searchParams: PageProps<"/museu/[id]">["searchParams"];
}) {
  const { id } = await params;
  const { criado } = await searchParams;
  const member = await getCurrentMember();
  const isMember = member?.status === "active";
  const album = await getAlbum(id, isMember);
  if (!album) notFound();
  const isOwner = isMember && album.createdBy === member.id;
  const canModerate = isMember && member.permissions.includes(PERMISSIONS.storiesModerate);
  const visible = album.photos.filter((photo) => !photo.isHidden || isMember);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Museu" title={album.title} />
      <p className="rotulo text-sepia-escuro">
        {album.year ? `${album.year} · ` : ""}
        {album.visibility === "public" ? "Público" : "Só integrantes"}
        {album.creatorName ? ` · criado por ${album.creatorName}` : ""}
      </p>
      <p>
        <Link href="/museu" className="underline underline-offset-4">
          Voltar ao museu
        </Link>
        {isOwner ? (
          <>
            {" · "}
            <Link href={`/museu/${album.id}/editar`} className="underline underline-offset-4">
              Editar álbum
            </Link>
          </>
        ) : null}
      </p>
      {criado === "1" ? <Notice tone="success">Álbum criado. Adicione as primeiras fotos abaixo.</Notice> : null}
      {album.isHidden ? <Notice>Este álbum está oculto pela moderação{album.hiddenReason ? `: ${album.hiddenReason}` : "."}</Notice> : null}
      {album.description ? <p className="max-w-prose whitespace-pre-line">{album.description}</p> : null}

      {visible.length === 0 ? (
        <Notice>Este álbum ainda não tem fotos.</Notice>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((photo) => (
            <li key={photo.id} className="flex flex-col gap-2">
              {photo.url ? (
                <img
                  src={photo.url}
                  alt={photo.caption ?? `Foto do álbum “${album.title}”`}
                  loading="lazy"
                  className="w-full rounded-sm border-2 border-sepia"
                />
              ) : null}
              {photo.caption ? <p className="text-sm">{photo.caption}</p> : null}
              {photo.isHidden ? (
                <p className="text-sm font-semibold text-vinho">
                  Foto oculta pela moderação{photo.hiddenReason ? `: ${photo.hiddenReason}` : ""}.
                </p>
              ) : null}
              {isMember && (photo.uploadedBy === member.id || isOwner) ? (
                <RemoveAlbumPhotoForm albumId={album.id} photoId={photo.id} />
              ) : null}
              {canModerate ? (
                <HideMuseumItemForm kind="photo" id={photo.id} albumId={album.id} hidden={photo.isHidden} />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {isMember && !album.isHidden ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Adicionar foto</h2>
          <p className="text-sm text-sepia-escuro">
            {album.visibility === "public"
              ? "Este álbum é público: qualquer pessoa verá a foto. Só envie se quem aparece concordou."
              : "Só integrantes veem este álbum."}
          </p>
          <AlbumPhotoForm albumId={album.id} />
        </Card>
      ) : null}

      {canModerate ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Moderação do álbum</h2>
          <HideMuseumItemForm kind="album" id={album.id} albumId={album.id} hidden={album.isHidden} />
        </Card>
      ) : null}
    </div>
  );
}

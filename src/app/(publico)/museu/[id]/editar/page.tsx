import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { Card } from "@/components/ui/card";
import { SectionHeading } from "@/components/ui/section-heading";
import { AlbumForm, DeleteAlbumForm } from "@/features/museu/components/museum-forms";
import { getAlbum } from "@/features/museu/queries";
import { requireActiveMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Editar álbum" };

export default function EditAlbumPage({ params }: PageProps<"/museu/[id]/editar">) {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: PageProps<"/museu/[id]/editar">["params"] }) {
  const member = await requireActiveMember();
  const { id } = await params;
  const album = await getAlbum(id, false);
  if (!album) notFound();
  if (album.createdBy !== member.id) redirect(`/museu/${id}`);
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Museu" title="Editar álbum" />
      <p>
        <Link href={`/museu/${id}`} className="underline underline-offset-4">
          Voltar ao álbum
        </Link>
      </p>
      <Card>
        <AlbumForm
          album={{
            id: album.id,
            title: album.title,
            description: album.description ?? "",
            year: album.year ? String(album.year) : "",
            visibility: album.visibility,
          }}
        />
      </Card>
      <Card>
        <DeleteAlbumForm id={album.id} />
      </Card>
    </div>
  );
}

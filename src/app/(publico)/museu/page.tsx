import type { Metadata } from "next";
import { Suspense } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { AlbumCard } from "@/features/museu/components/album-card";
import { listAlbums } from "@/features/museu/queries";
import { getCurrentMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Museu" };

/** Visitantes veem os álbuns públicos; integrantes, todos (a RLS decide). */
export default function MuseumPage({ searchParams }: PageProps<"/museu">) {
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Portal" title="Museu" />
      <p className="max-w-prose">Fotos da república ao longo dos anos, reunidas em álbuns.</p>
      <Suspense fallback={<p>Carregando álbuns…</p>}>
        <Albums searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Albums({ searchParams }: { searchParams: PageProps<"/museu">["searchParams"] }) {
  const { apagado } = await searchParams;
  const [albums, member] = await Promise.all([listAlbums(), getCurrentMember()]);
  const isMember = member?.status === "active";
  return (
    <>
      {isMember ? (
        <div>
          <ButtonLink href="/museu/novo">Criar álbum</ButtonLink>
        </div>
      ) : null}
      {apagado === "1" ? <Notice tone="success">Álbum apagado.</Notice> : null}
      {albums.length === 0 ? (
        <Notice>{isMember ? "Nenhum álbum ainda. Crie o primeiro!" : "Nenhum álbum público por enquanto."}</Notice>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <li key={album.id}>
              <AlbumCard album={album} />
            </li>
          ))}
        </ul>
      )}
      {!isMember ? <p className="text-sm text-sepia-escuro">Integrantes veem também os álbuns internos.</p> : null}
    </>
  );
}

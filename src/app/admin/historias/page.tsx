import type { Metadata } from "next";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { HideStoryForm } from "@/features/historias/components/story-forms";
import { StoryCard } from "@/features/historias/components/story-card";
import { listStories } from "@/features/historias/queries";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Moderar histórias" };

export default async function AdminStoriesPage({ searchParams }: PageProps<"/admin/historias">) {
  await requirePermission(PERMISSIONS.storiesModerate);
  const { filtro } = await searchParams;
  const onlyHidden = filtro === "ocultas";
  const all = await listStories(200);
  const stories = onlyHidden ? all.filter((story) => story.isHidden) : all;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Administração" title="Moderar histórias" />
      <p className="max-w-prose">
        Ocultar tira a história da vista dos outros integrantes sem apagar o texto; a autoria ainda a vê, com o motivo.
        Comentários impróprios são apagados dentro da própria história.
      </p>
      <nav aria-label="Filtro" className="flex gap-5">
        <Link href="/admin/historias" className={onlyHidden ? "underline" : "font-bold underline"}>Todas ({all.length})</Link>
        <Link href="/admin/historias?filtro=ocultas" className={onlyHidden ? "font-bold underline" : "underline"}>
          Ocultas ({all.filter((story) => story.isHidden).length})
        </Link>
      </nav>
      {stories.length === 0 ? (
        <Notice>{onlyHidden ? "Nenhuma história oculta." : "Nenhuma história ainda."}</Notice>
      ) : (
        <ul className="flex flex-col gap-4">
          {stories.map((story) => (
            <li key={story.id} className="flex flex-col gap-2">
              <StoryCard story={story} href={`/historias/${story.id}`} />
              <Card>
                <HideStoryForm storyId={story.id} hidden={story.isHidden} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { StoryCard } from "@/features/historias/components/story-card";
import { listStories } from "@/features/historias/queries";
import { requireActiveMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Histórias" };

export default async function StoriesPage({ searchParams }: PageProps<"/historias">) {
  await requireActiveMember();
  const { apagada } = await searchParams;
  const stories = await listStories();
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Área de integrantes" title="Histórias" />
      <p className="max-w-prose">Memórias da república contadas por quem viveu. Só integrantes leem.</p>
      <div>
        <ButtonLink href="/historias/nova">Contar uma história</ButtonLink>
      </div>
      {apagada === "1" ? <Notice tone="success">História apagada.</Notice> : null}
      {stories.length === 0 ? (
        <Notice>Nenhuma história ainda. Que tal contar a primeira?</Notice>
      ) : (
        <ul className="flex flex-col gap-4">
          {stories.map((story) => (
            <li key={story.id}>
              <StoryCard story={story} href={`/historias/${story.id}`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

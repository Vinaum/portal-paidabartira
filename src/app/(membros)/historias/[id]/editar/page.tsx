/* eslint-disable @next/next/no-img-element -- endereço assinado e temporário. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { DeleteStoryForm, RemovePhotoForm, StoryForm, StoryPhotoForm } from "@/features/historias/components/story-forms";
import { getStory } from "@/features/historias/queries";
import { requireActiveMember } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Editar história" };

export default async function EditStoryPage({ params, searchParams }: PageProps<"/historias/[id]/editar">) {
  const member = await requireActiveMember();
  const { id } = await params;
  const { criada } = await searchParams;
  const story = await getStory(id);
  if (!story) notFound();
  if (story.authorId !== member.id) redirect(`/historias/${id}`);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Histórias" title="Editar história" />
      {criada === "1" ? (
        <Notice tone="success">História publicada. Se quiser, anexe fotos abaixo.</Notice>
      ) : null}
      {story.isHidden ? (
        <Notice>A moderação ocultou esta história{story.hiddenReason ? `: ${story.hiddenReason}` : "."}</Notice>
      ) : null}
      <p>
        <Link href={`/historias/${id}`} className="underline underline-offset-4">
          Ver como os outros veem
        </Link>
      </p>
      <Card>
        <StoryForm story={{ id: story.id, title: story.title, body: story.body, era: story.era ?? "" }} />
      </Card>
      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold">Fotos ({story.photos.length}/4)</h2>
        {story.photos.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {story.photos.map((photo) => (
              <li key={photo.id} className="flex flex-col gap-2">
                {photo.url ? <img src={photo.url} alt="" className="w-full rounded-sm border-2 border-sepia" /> : null}
                <RemovePhotoForm storyId={story.id} photoId={photo.id} />
              </li>
            ))}
          </ul>
        ) : null}
        {story.photos.length < 4 ? <StoryPhotoForm storyId={story.id} /> : <p>Limite de 4 fotos atingido.</p>}
      </Card>
      <Card>
        <DeleteStoryForm id={story.id} />
      </Card>
    </div>
  );
}

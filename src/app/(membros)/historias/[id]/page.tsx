/* eslint-disable @next/next/no-img-element -- endereço assinado e temporário. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { AddCommentForm, DeleteCommentForm, HideStoryForm } from "@/features/historias/components/story-forms";
import { getStory, listComments } from "@/features/historias/queries";
import { requireActiveMember } from "@/lib/auth/session";
import { formatDay } from "@/lib/format";
import { PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "História" };

export default async function StoryPage({ params }: PageProps<"/historias/[id]">) {
  const member = await requireActiveMember();
  const { id } = await params;
  const story = await getStory(id);
  if (!story) notFound();
  const comments = await listComments(id);
  const isAuthor = story.authorId === member.id;
  const canModerate = member.permissions.includes(PERMISSIONS.storiesModerate);

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading as="h1" kicker="Histórias" title={story.title} />
      <p className="rotulo text-sepia-escuro">
        {story.authorName}
        {story.era ? ` · ${story.era}` : ""} · {formatDay(story.createdAt.slice(0, 10))}
      </p>
      <p>
        <Link href="/historias" className="underline underline-offset-4">
          Voltar às histórias
        </Link>
        {isAuthor ? (
          <>
            {" · "}
            <Link href={`/historias/${story.id}/editar`} className="underline underline-offset-4">
              Editar
            </Link>
          </>
        ) : null}
      </p>
      {story.isHidden ? (
        <Notice>
          Esta história está oculta pela moderação e só aparece para a autoria e a moderação.
        </Notice>
      ) : null}
      <Card className="flex flex-col gap-4">
        <p className="whitespace-pre-line">{story.body}</p>
        {story.photos.some((photo) => photo.url) ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {story.photos.map((photo) =>
              photo.url ? (
                <li key={photo.id}>
                  <img src={photo.url} alt={`Foto da história “${story.title}”`} loading="lazy" className="w-full rounded-sm border-2 border-sepia" />
                </li>
              ) : null,
            )}
          </ul>
        ) : null}
      </Card>

      <section aria-labelledby="comentarios" className="flex flex-col gap-3">
        <h2 id="comentarios" className="text-2xl font-semibold">
          Comentários
        </h2>
        {comments.length === 0 ? <p>Ninguém comentou ainda.</p> : null}
        <ul className="flex flex-col gap-2">
          {comments.map((comment) => (
            <li key={comment.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-sm border border-sepia bg-papel p-3">
              <span>
                <strong>{comment.authorName}</strong>: <span className="whitespace-pre-line">{comment.body}</span>
              </span>
              {comment.authorId === member.id || canModerate ? <DeleteCommentForm id={comment.id} /> : null}
            </li>
          ))}
        </ul>
        {!story.isHidden ? (
          <Card>
            <AddCommentForm storyId={story.id} />
          </Card>
        ) : null}
      </section>

      {canModerate ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold">Moderação</h2>
          {story.isHidden && story.hiddenReason ? <p>Motivo registrado: {story.hiddenReason}</p> : null}
          <HideStoryForm storyId={story.id} hidden={story.isHidden} />
        </Card>
      ) : null}
    </div>
  );
}

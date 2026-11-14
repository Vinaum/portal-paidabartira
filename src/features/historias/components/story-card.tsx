/* eslint-disable @next/next/no-img-element -- endereço assinado e temporário. */
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Stamp } from "@/components/ui/seal";
import { formatDay } from "@/lib/format";

import type { Story } from "../queries";

export function StoryCard({ story, href }: { story: Story; href: string }) {
  const cover = story.photos.find((photo) => photo.url);
  return (
    <Card className="flex gap-4">
      {cover?.url ? (
        <img src={cover.url} alt="" loading="lazy" className="h-28 w-28 shrink-0 rounded-sm border-2 border-sepia object-cover" />
      ) : null}
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-2xl font-semibold">
          <Link href={href} className="underline-offset-4 hover:underline">
            {story.title}
          </Link>
        </h2>
        <p className="rotulo text-sepia-escuro">
          {story.authorName}
          {story.era ? ` · ${story.era}` : ""} · {formatDay(story.createdAt.slice(0, 10))}
        </p>
        {story.isHidden ? <Stamp tone="vinho">Oculta pela moderação</Stamp> : null}
        <p className="line-clamp-3 whitespace-pre-line">{story.body}</p>
      </div>
    </Card>
  );
}

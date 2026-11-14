import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Stamp } from "@/components/ui/seal";
import { formatDay } from "@/lib/format";

import type { Announcement } from "../queries";

export function AnnouncementCard({ announcement, href, full = true }: { announcement: Announcement; href?: string; full?: boolean }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-2xl font-semibold">
          {href ? (
            <Link href={href} className="underline-offset-4 hover:underline">
              {announcement.title}
            </Link>
          ) : (
            announcement.title
          )}
        </h2>
        <span className="flex gap-2">
          {announcement.is_pinned ? <Stamp tone="verde">Fixado</Stamp> : null}
          {announcement.visibility === "members" ? <Stamp tone="preto">Só integrantes</Stamp> : null}
        </span>
      </div>
      <p className="rotulo text-sepia-escuro">
        {formatDay(announcement.created_at.slice(0, 10))}
        {announcement.expires_on ? ` · vale até ${formatDay(announcement.expires_on)}` : ""}
      </p>
      <p className={full ? "whitespace-pre-line" : "line-clamp-3 whitespace-pre-line"}>{announcement.body}</p>
    </Card>
  );
}

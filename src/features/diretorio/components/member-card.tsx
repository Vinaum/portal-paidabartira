import Link from "next/link";

import { Seal } from "@/components/ui/seal";
import { formatPeriodYears } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/permissions";

import type { DirectoryEntry } from "../queries";
import { MemberPhoto } from "./member-photo";

export function MemberCard({ entry }: { entry: DirectoryEntry }) {
  const place = [entry.current_city, entry.current_country].filter(Boolean).join(", ");
  const work = [entry.job_title, entry.company].filter(Boolean).join(" · ");
  const periods = entry.periods.map((period) => formatPeriodYears(period.started_on, period.ended_on)).join(", ");

  return (
    <li className="flex gap-4 rounded-sm border border-sepia bg-papel p-4">
      <MemberPhoto url={entry.photoUrl} name={entry.display_name} size={80} />
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-xl font-semibold leading-tight">
          <Link href={`/diretorio/${entry.member_id}`} className="underline-offset-4 hover:underline">
            {entry.display_name}
          </Link>
        </h2>
        <div className="flex flex-wrap gap-2">
          <Seal>{CATEGORY_LABELS[entry.category]}</Seal>
          {entry.is_founder ? <Seal tone="vinho">Fundador</Seal> : null}
        </div>
        {periods ? <p className="text-sm">Na casa: {periods}</p> : null}
        {work ? <p className="truncate text-sm">{work}</p> : null}
        {place ? <p className="text-sm text-sepia-escuro">{place}</p> : null}
      </div>
    </li>
  );
}

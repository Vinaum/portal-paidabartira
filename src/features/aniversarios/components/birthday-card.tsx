import { Card } from "@/components/ui/card";
import { Stamp } from "@/components/ui/seal";
import { formatDay } from "@/lib/format";

import type { UpcomingBirthday } from "../dates";

export function BirthdayCard({ birthday, today }: { birthday: UpcomingBirthday; today: string }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 py-3">
      <p>
        <span aria-hidden="true">🎂 </span>
        <strong>Aniversário de {birthday.name}</strong>
        <span className="rotulo ml-3 text-sepia-escuro">{formatDay(birthday.date)}</span>
      </p>
      {birthday.date === today ? <Stamp tone="verde">Hoje</Stamp> : <Stamp tone="preto">Aniversário</Stamp>}
    </Card>
  );
}

/**
 * Datas de evento. O banco guarda instantes (timestamptz); as pessoas pensam
 * no horário de Brasília. Estas funções convertem entre o campo
 * `datetime-local` do formulário ("2026-11-14T19:00", sem fuso) e o instante.
 */
const TZ = "America/Sao_Paulo";

const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const offsetFormat = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" });

/** Instante (ISO) -> "2026-11-14T19:00" em Brasília. */
export function toLocalInput(iso: string): string {
  const parts = Object.fromEntries(partsFormat.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function offsetMinutes(at: number): number {
  const name = offsetFormat.formatToParts(new Date(at)).find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT(?:([+-])(\d{2}):(\d{2}))?/.exec(name);
  if (!match || !match[1]) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

/** "2026-11-14T19:00" em Brasília -> instante ISO; null se o texto ou o horário não existir. */
export function fromLocalInput(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const asUtc = Date.parse(`${local}:00Z`);
  if (Number.isNaN(asUtc)) return null;
  let instant = asUtc - offsetMinutes(asUtc) * 60_000;
  const corrected = asUtc - offsetMinutes(instant) * 60_000;
  if (corrected !== instant) instant = corrected;
  // Horário inexistente (ex.: pulo de horário de verão) não volta igual.
  if (toLocalInput(new Date(instant).toISOString()) !== local) return null;
  return new Date(instant).toISOString();
}

const dayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const shortDayFormat = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: TZ });
const shortMonthFormat = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: TZ });

/** "sábado, 14 de novembro · 19:00 às 23:00" */
export function formatEventWhen(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const day = dayFormat.format(start);
  const from = timeFormat.format(start);
  if (!endsAt) return `${day} · ${from}`;
  const end = new Date(endsAt);
  const sameDay = toLocalInput(startsAt).slice(0, 10) === toLocalInput(endsAt).slice(0, 10);
  return sameDay
    ? `${day} · ${from} às ${timeFormat.format(end)}`
    : `${day}, ${from} até ${dayFormat.format(end)}, ${timeFormat.format(end)}`;
}

/** Peça do "calendário" nos cartões: dia e mês abreviado. */
export function eventDayParts(startsAt: string): { day: string; month: string } {
  const start = new Date(startsAt);
  return { day: shortDayFormat.format(start), month: shortMonthFormat.format(start).replace(".", "") };
}

/** O evento já terminou? Sem hora de fim, vale o início. */
export function isPast(startsAt: string, endsAt: string | null, now = new Date()): boolean {
  return new Date(endsAt ?? startsAt).getTime() < now.getTime();
}

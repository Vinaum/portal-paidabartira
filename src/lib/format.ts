/** Datas sempre no fuso de Brasília, independentemente de onde o servidor roda. */
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "America/Sao_Paulo",
});
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

/** "2007-03-01" -> "março de 2007". Datas de período guardam só mês e ano. */
export function formatMonth(isoDate: string): string {
  return monthFormat.format(new Date(`${isoDate.slice(0, 7)}-01T00:00:00Z`));
}

/** Período de residência: "março de 2007 a julho de 2010" ou "... até hoje". */
export function formatPeriod(startedOn: string, endedOn: string | null): string {
  return `${formatMonth(startedOn)} ${endedOn ? `a ${formatMonth(endedOn)}` : "até hoje"}`;
}

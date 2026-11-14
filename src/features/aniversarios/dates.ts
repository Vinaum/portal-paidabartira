export type Birthday = { memberId: string; name: string; day: number; month: number };
export type UpcomingBirthday = Birthday & { date: string };

const pad = (n: number) => String(n).padStart(2, "0");
const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

/** Próxima ocorrência (YYYY-MM-DD) a partir de `today`. 29/02 em ano comum cai em 28/02. */
export function nextOccurrence(day: number, month: number, today: string): string {
  const year = Number(today.slice(0, 4));
  const inYear = (y: number) => {
    const d = month === 2 && day === 29 && !isLeap(y) ? 28 : day;
    return `${y}-${pad(month)}-${pad(d)}`;
  };
  const thisYear = inYear(year);
  return thisYear >= today ? thisYear : inYear(year + 1);
}

/** Aniversários que caem entre hoje e hoje + `days`, em ordem de data. */
export function upcomingBirthdays(birthdays: Birthday[], today: string, days: number): UpcomingBirthday[] {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + days);
  const end = limit.toISOString().slice(0, 10);
  return birthdays
    .map((birthday) => ({ ...birthday, date: nextOccurrence(birthday.day, birthday.month, today) }))
    .filter((birthday) => birthday.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "pt-BR"));
}

/** Dia (YYYY-MM-DD) de um instante, no fuso de Brasília. */
export function dayInBrasilia(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

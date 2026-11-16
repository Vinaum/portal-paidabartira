/**
 * Ano de ingresso na faculdade, a "turma": quem entrou em 2006 é "06".
 * Os moradores se tratam assim, então o portal aceita as duas formas ao
 * digitar ("06" ou "2006") e mostra a etiqueta curta.
 */
export const MIN_ENTRY_YEAR = 1950;

/** "06" -> 2006, "95" -> 1995, "2006" -> 2006. Qualquer outra coisa -> null. */
export function parseEntryYear(input: string, now: Date = new Date()): number | null {
  const text = input.trim().replace(/^[’']/, "");
  let year: number;
  if (/^\d{4}$/.test(text)) year = Number(text);
  else if (/^\d{2}$/.test(text)) year = Number(text) <= 49 ? 2000 + Number(text) : 1900 + Number(text);
  else return null;
  // Aceita o ano que vem: quem passou no vestibular entra em fevereiro.
  return year >= MIN_ENTRY_YEAR && year <= now.getFullYear() + 1 ? year : null;
}

/** 2006 -> "’06". */
export function entryYearTag(year: number): string {
  return `’${String(year % 100).padStart(2, "0")}`;
}

/**
 * Identidade da república. Só entram aqui dados informados pela própria
 * república; o que ainda não foi informado fica `null` e a interface mostra
 * um marcador entre colchetes. Os mesmos valores existem em
 * `republic_settings` (banco) para edição futura pelo painel.
 */
export const site = {
  name: "Paidabartira",
  /** Data de fundação informada em 11/11/2026 (ISO, sem horário). */
  foundedOn: "2007-03-04",
  foundersNote:
    "Fundada por alunos de Engenharia de Computação da turma EC06 da UNICAMP.",
  sealBottomText: "EC06 · UNICAMP",
  history: null as string | null,
  contactEmail: null as string | null,
  description:
    "Portal da república Paidabartira: comunidade, memória e encontros entre gerações de moradores.",
} as const;

export function foundedYear(): string {
  return site.foundedOn.slice(0, 4);
}

export function foundedOnLong(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${site.foundedOn}T00:00:00Z`));
}

/** Texto exibido quando um dado institucional ainda não foi preenchido. */
export function placeholder(label: string): string {
  return `[${label} — a preencher]`;
}

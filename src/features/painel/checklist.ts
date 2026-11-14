/** Itens sugeridos para completar o perfil. Função pura: recebe o que já foi lido do banco. */
export type ChecklistInput = {
  hasPhoto: boolean;
  bio: string | null;
  periodCount: number;
  hasBirthday: boolean;
  hasContact: boolean;
  hasEducationOrWork: boolean;
};

export type ChecklistItem = { id: string; label: string; done: boolean; href: string };

export function profileChecklist(input: ChecklistInput): { items: ChecklistItem[]; done: number; total: number } {
  const items: ChecklistItem[] = [
    { id: "photo", label: "Adicionar uma foto de perfil", done: input.hasPhoto, href: "/perfil" },
    { id: "bio", label: "Escrever uma apresentação", done: Boolean(input.bio?.trim()), href: "/perfil" },
    { id: "periods", label: "Informar quando morou na casa", done: input.periodCount > 0, href: "/perfil" },
    { id: "birthday", label: "Cadastrar o aniversário (dia e mês)", done: input.hasBirthday, href: "/perfil" },
    { id: "contact", label: "Deixar um contato ou rede social", done: input.hasContact, href: "/perfil" },
    { id: "career", label: "Contar sobre formação ou trabalho", done: input.hasEducationOrWork, href: "/perfil" },
  ];
  return { items, done: items.filter((item) => item.done).length, total: items.length };
}

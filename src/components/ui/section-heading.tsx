/** Cabeçalho editorial: número da seção, fio duplo e título serifado. */
export function SectionHeading({
  number,
  title,
  kicker,
  as: Tag = "h2",
}: {
  number?: string;
  title: string;
  kicker?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <header className="fio-duplo pt-3">
      <p className="rotulo flex gap-3 text-sepia-escuro">
        {number ? <span aria-hidden="true">Nº {number}</span> : null}
        {kicker ? <span>{kicker}</span> : null}
      </p>
      <Tag className="mt-1 text-3xl font-semibold text-preto sm:text-4xl">{title}</Tag>
    </header>
  );
}

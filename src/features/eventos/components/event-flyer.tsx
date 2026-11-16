import type { EventRow } from "../queries";
import { flyerUrl } from "../flyer";

/** Flyer do evento, se houver. Clicar abre a imagem inteira (o texto pequeno precisa de zoom). */
export function EventFlyer({ event, className = "" }: { event: Pick<EventRow, "id" | "title" | "flyer_path">; className?: string }) {
  const url = flyerUrl(event.id, event.flyer_path);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      className={`block self-start ${className}`}
      aria-label={`Abrir o flyer do evento ${event.title} em tamanho grande`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rota própria que confere a visibilidade; o otimizador não ajuda. */}
      <img
        src={url}
        alt={`Flyer do evento ${event.title}`}
        loading="lazy"
        className="max-h-[32rem] w-auto max-w-full rounded-sm border border-sepia"
      />
    </a>
  );
}

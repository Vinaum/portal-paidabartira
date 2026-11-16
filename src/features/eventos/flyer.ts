/** Bucket privado dos flyers. Só o servidor lê e grava (admin client). */
export const EVENT_BUCKET = "event-media";

/** Lado maior do flyer depois de reencodado. Texto pequeno precisa de resolução. */
export const FLYER_MAX_SIDE = 1800;

/** Caminho no bucket: "<id do evento>/<uuid>.webp". Mesmo formato que o banco exige. */
export function flyerStoragePath(eventId: string): string {
  return `${eventId}/${crypto.randomUUID()}.webp`;
}

/**
 * Endereço da imagem. Passa pela rota /api/eventos/<id>/flyer, que confere a
 * visibilidade do evento; `v` (o nome do arquivo) muda quando o flyer é trocado,
 * então o navegador não mostra o antigo.
 */
export function flyerUrl(eventId: string, flyerPath: string | null): string | null {
  if (!flyerPath) return null;
  const version = flyerPath.split("/").pop()?.replace(/\.webp$/, "") ?? "";
  return `/api/eventos/${eventId}/flyer?v=${encodeURIComponent(version)}`;
}

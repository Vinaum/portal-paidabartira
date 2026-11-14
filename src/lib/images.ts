import "server-only";

import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Decodifica, corrige a orientação, limita o lado maior e regrava em WebP.
 * Isso descarta metadados (inclusive GPS) e recusa o que não for imagem.
 */
export async function reencodeToWebp(
  file: unknown,
  maxSide: number,
): Promise<{ ok: true; data: Buffer } | { ok: false; message: string }> {
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Escolha uma imagem." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: "A imagem passa de 4 MB. Escolha uma menor." };
  try {
    const data = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 50_000_000 })
      .rotate()
      .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    return { ok: true, data };
  } catch {
    return { ok: false, message: "Não foi possível ler esta imagem. Use JPEG, PNG ou WebP." };
  }
}

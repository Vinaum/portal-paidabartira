/* eslint-disable @next/next/no-img-element -- endereço assinado e temporário: o otimizador de imagens não ajuda. */

/** Foto do integrante; sem foto (ou sem permissão), as iniciais sobre papel. */
export function MemberPhoto({ url, name, size = 96 }: { url: string | null; name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return url ? (
    <img
      src={url}
      alt={`Foto de ${name}`}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-sm border-2 border-sepia object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-sm border-2 border-dashed border-sepia bg-papel font-display font-bold text-sepia-escuro"
      style={{ width: size, height: size, fontSize: size / 3 }}
    >
      {initials}
    </div>
  );
}

import Image from "next/image";

import { foundedYear, site } from "@/config/site";
import logo from "@/assets/logo-paidabartira.png";

/**
 * Logotipo oficial da república (selo preto e branco).
 * Para trocar, substitua `src/assets/logo-paidabartira.png` (quadrado,
 * fundo transparente, ao menos 512 px); nenhum outro arquivo precisa mudar.
 */
export function LogoSeal({ size = 96, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src={logo}
      width={size}
      height={size}
      alt={`Logotipo da república ${site.name}, fundada em ${foundedYear()}`}
      className={className}
    />
  );
}

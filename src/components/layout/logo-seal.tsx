import { foundedYear, site } from "@/config/site";

/**
 * Logotipo PROVISÓRIO: selo circular montado a partir de `config/site.ts`.
 * Quando a república enviar um logotipo, troque este componente por uma
 * imagem; nenhum outro arquivo precisa mudar.
 */
export function LogoSeal({ size = 96, className = "" }: { size?: number; className?: string }) {
  const name = site.name.toUpperCase();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Selo provisório da república ${site.name}, fundada em ${foundedYear()}`}
      className={className}
    >
      <defs>
        <path id="selo-arco-superior" d="M 60 60 m -43 0 a 43 43 0 1 1 86 0" />
        <path id="selo-arco-inferior" d="M 60 60 m -47 0 a 47 47 0 0 0 94 0" />
      </defs>
      <circle cx="60" cy="60" r="58" fill="var(--color-verde)" />
      <circle cx="60" cy="60" r="53" fill="none" stroke="var(--color-creme)" strokeWidth="1" />
      <circle cx="60" cy="60" r="30" fill="var(--color-preto)" stroke="var(--color-creme)" strokeWidth="1" />
      <text fill="var(--color-creme)" fontFamily="var(--font-display)" fontSize="12.5" fontWeight="700" letterSpacing="2.2">
        <textPath href="#selo-arco-superior" startOffset="50%" textAnchor="middle">
          {name}
        </textPath>
      </text>
      <text fill="var(--color-creme)" fontFamily="var(--font-mono)" fontSize="8" letterSpacing="1.6">
        <textPath href="#selo-arco-inferior" startOffset="50%" textAnchor="middle">
          {site.sealBottomText}
        </textPath>
      </text>
      <text
        x="60"
        y="66"
        textAnchor="middle"
        fill="var(--color-creme)"
        fontFamily="var(--font-display)"
        fontSize="17"
        fontWeight="700"
      >
        {foundedYear()}
      </text>
    </svg>
  );
}

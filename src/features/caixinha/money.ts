/**
 * Dinheiro sempre em centavos inteiros. Nenhuma conta usa ponto flutuante:
 * o texto digitado é convertido por manipulação de string.
 */
export const MAX_CENTS = 100_000_000_000; // R$ 1 bilhão, igual ao CHECK do banco

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number): string {
  return brl.format(cents / 100);
}

/**
 * "1.234,56", "1234,56", "1234.56", "R$ 50" -> centavos. Devolve null para
 * qualquer coisa ambígua ou inválida (negativo, letras, mais de 2 casas,
 * zero, acima do limite).
 */
export function parseBRL(input: string): number | null {
  let text = input.replace(/R\$/gi, "").replace(/\s+/g, "");
  if (text === "") return null;

  if (text.includes(",") && text.includes(".")) {
    // O último separador é o decimal; o outro é de milhar.
    const decimal = text.lastIndexOf(",") > text.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    if (text.split(decimal).length > 2) return null;
    text = text.split(thousands).join("").replace(decimal, ",");
  } else if (text.includes(".")) {
    // Só pontos: milhar ("1.234" ou "1.234.567") ou decimal ("12.5").
    text = /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replaceAll(".", "") : text.replace(".", ",");
  }

  const match = /^(\d+)(?:,(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const whole = match[1]!;
  const fraction = (match[2] ?? "").padEnd(2, "0");
  if (whole.length > 12) return null;
  const cents = Number(whole) * 100 + Number(fraction || "0");
  return cents > 0 && cents <= MAX_CENTS ? cents : null;
}

/** Centavos -> texto editável ("1234,56"), para preencher formulários. */
export function centsToInput(cents: number): string {
  const whole = Math.floor(cents / 100);
  const fraction = String(cents % 100).padStart(2, "0");
  return `${whole},${fraction}`;
}

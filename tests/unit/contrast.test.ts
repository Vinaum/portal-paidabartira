import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Lê a paleta de globals.css (fonte única) e confere contraste WCAG AA. */
const css = readFileSync("src/app/globals.css", "utf8");
const colors = Object.fromEntries(
  [...css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
);

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(colors[foreground]), luminance(colors[background])].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

// [texto, fundo] de todas as combinações usadas pelos componentes.
const textPairs: [string, string][] = [
  ["preto", "creme"],
  ["preto", "papel"],
  ["creme", "verde"],
  ["creme", "musgo"],
  ["creme", "preto"],
  ["papel", "preto"],
  ["verde", "creme"],
  ["verde", "papel"],
  ["sepia-escuro", "creme"],
  ["sepia-escuro", "papel"],
  ["vinho", "creme"],
  ["vinho", "papel"],
];

describe("contraste da paleta (WCAG AA, texto normal >= 4.5)", () => {
  it("encontra todas as cores no CSS", () => {
    for (const name of new Set(textPairs.flat())) {
      expect(colors[name], `cor ${name}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(textPairs)("%s sobre %s", (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("bordas de campo (sépia) têm contraste >= 3 sobre o fundo", () => {
    expect(contrast("sepia", "creme")).toBeGreaterThanOrEqual(3);
  });
});

/**
 * Paleta de cores em comparação (missão 22, iteração 6).
 * "grafite" é o tema atual; "indigo" é o 60/30/10 Índigo Noturno · Pêssego Claro · Ciano Elétrico,
 * gerado em styles-palette-indigo.css e ativo por html[data-palette="indigo"].
 */
export type Palette = "grafite" | "indigo";
const KEY = "tesseract-palette";

export function readPalette(): Palette {
  try {
    return globalThis.localStorage?.getItem(KEY) === "indigo" ? "indigo" : "grafite";
  } catch {
    return "grafite";
  }
}

export function applyPalette(p: Palette): void {
  if (typeof document === "undefined") return;
  if (p === "indigo") document.documentElement.dataset.palette = "indigo";
  else delete document.documentElement.dataset.palette;
  try {
    globalThis.localStorage?.setItem(KEY, p);
  } catch {
    /* armazenamento indisponível: vale só para esta aba */
  }
}

// aplica antes do primeiro render para não piscar o tema errado
if (typeof document !== "undefined") applyPalette(readPalette());

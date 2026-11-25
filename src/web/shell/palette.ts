/**
 * Paleta de cores em comparação (missão 22, iteração 6).
 * "indigo" (padrão) é o 60/30/10 Índigo Noturno · Pêssego Claro · Ciano Elétrico,
 * gerado em styles-palette-indigo.css e ativo por html[data-palette="indigo"];
 * "grafite" é o tema anterior, mantido como alternativa.
 */
export type Palette = "grafite" | "indigo";
const KEY = "tesseract-palette";

export function readPalette(): Palette {
  try {
    // Índigo é o padrão desde a iteração 7; Grafite fica disponível como alternativa.
    return globalThis.localStorage?.getItem(KEY) === "grafite" ? "grafite" : "indigo";
  } catch {
    return "indigo";
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

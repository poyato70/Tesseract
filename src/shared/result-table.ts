/**
 * Visão amigável de resultados MCP: encontra a maior lista de registros dentro do
 * retorno (structuredContent ou texto JSON em content[]) e a expõe como tabela.
 * Usado no navegador (resultado completo) e no servidor (resultado acima de 128 kB,
 * quando o texto bruto é cortado e deixaria de ser JSON válido).
 */
import { toolPayloads } from "./advisor-i18n.js";

export type ResultTable = {
  /** Caminho da lista dentro do retorno, ex.: results.prices */
  path: string;
  total: number;
  columns: string[];
  rows: Record<string, unknown>[];
  /** true quando nem todas as linhas couberam no limite. */
  truncated: boolean;
};

export type ResultObject = { path: string; fields: [string, unknown][] };

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function largestRecordArray(root: unknown) {
  let best: { path: string; rows: Record<string, unknown>[] } | undefined;
  const visit = (node: unknown, path: string, depth: number) => {
    if (depth > 8 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      const rows = node.filter(isRecord);
      if (rows.length && rows.length >= node.length / 2 && (!best || rows.length > best.rows.length)) best = { path, rows };
      for (const item of node.slice(0, 3)) visit(item, path + "[]", depth + 1);
      return;
    }
    for (const [k, v] of Object.entries(node)) if (k !== "_meta") visit(v, path ? `${path}.${k}` : k, depth + 1);
  };
  visit(root, "", 0);
  return best;
}

/** Achata um nível de objetos aninhados (ex.: properties.impact → "properties.impact"). */
function flatten(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (isRecord(v)) for (const [k2, v2] of Object.entries(v)) out[`${k}.${k2}`] = v2;
    else out[k] = v;
  }
  return out;
}

export function resultTable(result: unknown, maxBytes = 100_000): ResultTable | undefined {
  for (const payload of toolPayloads(result).concat(isRecord(result) && !("content" in result) ? [result] : [])) {
    const found = largestRecordArray(payload);
    if (!found) continue;
    const flat = found.rows.map(flatten);
    const freq = new Map<string, number>();
    for (const r of flat.slice(0, 200))
      for (const [k, v] of Object.entries(r)) if (v === null || typeof v !== "object") freq.set(k, (freq.get(k) || 0) + 1);
    const columns = [...freq.keys()].slice(0, 40);
    const rows: Record<string, unknown>[] = [];
    let size = 0;
    for (const r of flat) {
      const row = Object.fromEntries(columns.filter((c) => c in r).map((c) => [c, r[c]]));
      size += JSON.stringify(row).length;
      if (size > maxBytes) break;
      rows.push(row);
    }
    return { path: found.path, total: flat.length, columns, rows, truncated: rows.length < flat.length };
  }
}

/** Para retornos sem lista: campos simples do primeiro objeto encontrado. */
export function resultObject(result: unknown): ResultObject | undefined {
  for (const payload of toolPayloads(result)) {
    if (!isRecord(payload)) continue;
    const target = isRecord(payload.results) ? payload.results : payload;
    const fields = Object.entries(flatten(target)).filter(([k, v]) => k !== "_meta" && (v === null || typeof v !== "object"));
    if (fields.length) return { path: target === payload ? "" : "results", fields: fields.slice(0, 60) };
  }
}

export function tableCsv(t: ResultTable): string {
  // ";" e vírgula decimal: abre direto no Excel em pt-BR.
  const cell = (v: unknown) => {
    const s = v === undefined || v === null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [t.columns.join(";"), ...t.rows.map((r) => t.columns.map((c) => cell(r[c])).join(";"))].join("\n");
}

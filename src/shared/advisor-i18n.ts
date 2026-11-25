/**
 * Tradução das recomendações do Azure Advisor pelo próprio catálogo do Advisor.
 * As recomendações individuais (advisor_recommendation_list) chegam em inglês e não
 * aceitam idioma; o catálogo (advisor_metadata_list) aceita language=pt-BR. Os dois
 * compartilham recommendationTypeId, então o texto localizado é ligado por esse ID.
 */
export type AdvisorTypeText = { name?: string; problem?: string; solution?: string; description?: string };

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(v: unknown, limit = 600) {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, limit) : undefined;
}

/** Lê o resultado de tools/call (content de texto JSON ou structuredContent). */
export function toolPayloads(result: any): unknown[] {
  const out: unknown[] = [];
  if (result?.structuredContent) out.push(result.structuredContent);
  for (const c of Array.isArray(result?.content) ? result.content : []) {
    if (c?.type !== "text" || typeof c.text !== "string") continue;
    try {
      out.push(JSON.parse(c.text));
    } catch {
      /* texto livre: ignorado */
    }
  }
  return out;
}

/**
 * Extrai, de forma tolerante ao formato, os textos por ID de tipo de recomendação.
 * Aceita objetos com o ID em recommendationTypeId/typeId/id/name e textos em
 * displayName, label, description, shortDescription.{problem,solution} — no objeto
 * ou em `properties`.
 */
export function advisorTypeTexts(payloads: unknown[], limit = 5000): Map<string, AdvisorTypeText> {
  const map = new Map<string, AdvisorTypeText>();
  const seen = new Set<unknown>();
  const visit = (node: any, depth: number) => {
    if (!node || typeof node !== "object" || depth > 8 || seen.has(node) || map.size >= limit) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const n of node) visit(n, depth + 1);
      return;
    }
    const p = node.properties && typeof node.properties === "object" ? { ...node, ...node.properties } : node;
    const id = [p.recommendationTypeId, p.typeId, p.recommendationTypeID, p.id, p.name].find(
      (v) => typeof v === "string" && GUID.test(v),
    ) as string | undefined;
    if (id) {
      const entry: AdvisorTypeText = {
        name: text(p.displayName) ?? text(p.label),
        problem: text(p.shortDescription?.problem) ?? text(p.problem),
        solution: text(p.shortDescription?.solution) ?? text(p.solution),
        description: text(p.description, 900),
      };
      if (entry.name || entry.problem || entry.solution || entry.description) map.set(id.toLowerCase(), entry);
    }
    for (const v of Object.values(node)) if (v && typeof v === "object") visit(v, depth + 1);
  };
  for (const p of payloads) visit(p, 0);
  return map;
}

/** IDs de tipo presentes nas recomendações individuais. */
export function recommendationTypeIds(payloads: unknown[]): string[] {
  const ids = new Set<string>();
  for (const payload of payloads as any[]) {
    const recs = payload?.results?.recommendations;
    if (!Array.isArray(recs)) continue;
    for (const r of recs) {
      const id = r?.properties?.recommendationTypeId;
      if (typeof id === "string" && GUID.test(id)) ids.add(id.toLowerCase());
    }
  }
  return [...ids];
}

/** Texto em português para uma recomendação: solução localizada, senão nome do tipo. */
export function localizedSuggestion(
  localized: Record<string, AdvisorTypeText> | undefined,
  typeId?: string,
): string | undefined {
  const t = typeId ? localized?.[typeId.toLowerCase()] : undefined;
  return t?.solution ?? t?.name ?? t?.problem;
}

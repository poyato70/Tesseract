/**
 * Mapa único de rotas do Tesseract (rebuild missão 22).
 *
 * Cada página tem um id estável (usado pelas páginas legadas via onNavigate)
 * e um caminho legível. Integrações têm sub-rotas por conexão e por aba, de
 * modo que "onde integrar" e "onde testar" sejam sempre o mesmo lugar:
 * /integracoes/:id (visão) e /integracoes/:id/testar.
 */
export type IntegrationTab = "visao" | "testar" | "configuracao" | "atividade";

export type Route =
  | { page: "integration"; connectionId: string; tab: IntegrationTab }
  | { page: string; connectionId?: undefined; tab?: undefined };

export const pages: Record<string, { path: string; title: string; section: string }> = {
  home: { path: "/", title: "Visão geral", section: "Início" },
  integrations: { path: "/integracoes", title: "Minhas integrações", section: "Integrações" },
  catalog: { path: "/integracoes/catalogo", title: "Catálogo", section: "Integrações" },
  "integration-new": { path: "/integracoes/nova", title: "Nova integração", section: "Integrações" },
  accesses: { path: "/integracoes/credenciais", title: "Credenciais", section: "Integrações" },
  costs: { path: "/finops/custos", title: "Custos", section: "FinOps" },
  "tag-costs": { path: "/finops/tags", title: "Custos por tag", section: "FinOps" },
  forecast: { path: "/finops/forecast", title: "Forecast", section: "FinOps" },
  budgets: { path: "/finops/budgets", title: "Budgets", section: "FinOps" },
  benefits: { path: "/finops/compromissos", title: "Compromissos", section: "FinOps" },
  multicloud: { path: "/finops/multicloud", title: "Visão multicloud", section: "FinOps" },
  hubs: { path: "/finops/hub", title: "FinOps Hub", section: "FinOps" },
  "finops-correlation": { path: "/finops/correlacao", title: "Correlação MCP", section: "FinOps" },
  "api-lab": { path: "/finops/apis", title: "Laboratório de APIs", section: "FinOps" },
  agents: { path: "/ia/agentes", title: "Agentes", section: "IA" },
  "agent-lab": { path: "/ia/avaliacao", title: "Avaliação de agentes", section: "IA" },
  knowledge: { path: "/ia/conhecimento", title: "Conhecimento e skills", section: "IA" },
  chat: { path: "/ia/chat", title: "Chat", section: "IA" },
  investigations: { path: "/ia/investigacoes", title: "Investigações", section: "IA" },
  diagnostics: { path: "/operacao/atividade", title: "Atividade", section: "Operação" },
  new_features_ux: { path: "/operacao/observabilidade", title: "Observabilidade", section: "Operação" },
  help: { path: "/ajuda", title: "Guia e referências", section: "Operação" },
};

/** Ids antigos (missão 21) que páginas legadas ainda emitem via onNavigate. */
const legacyIds: Record<string, string> = {
  mcps: "integrations",
  "mcp-analysis": "integrations",
  discovery: "catalog",
};

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const tabs: IntegrationTab[] = ["visao", "testar", "configuracao", "atividade"];

export function normalizePage(id: string) {
  return legacyIds[id] || (pages[id] ? id : "home");
}

export function parsePath(rawPath: string): Route {
  const path = rawPath.replace(/\/+$/, "") || "/";
  // Endereços da missão 21 continuam válidos.
  const legacy = path.match(/^\/conexoes\/(integracao|inspetor|catalogo)(?:\/([^/]+))?$/);
  if (legacy) {
    const [, kind, id] = legacy;
    if (id && uuid.test(id))
      return { page: "integration", connectionId: id.toLowerCase(), tab: kind === "inspetor" ? "testar" : "visao" };
    return { page: kind === "catalogo" ? "catalog" : "integrations" };
  }
  if (path === "/new_features_ux") return { page: "new_features_ux" };
  const integration = path.match(/^\/integracoes\/([^/]+)(?:\/([^/]+))?$/);
  if (integration && uuid.test(integration[1])) {
    const tab = tabs.find((t) => t === integration[2]) || "visao";
    return { page: "integration", connectionId: integration[1].toLowerCase(), tab };
  }
  const match = Object.entries(pages).find(([, p]) => p.path === path);
  return { page: match ? match[0] : "home" };
}

export function formatPath(route: Route): string {
  if (route.page === "integration")
    return `/integracoes/${route.connectionId}${route.tab && route.tab !== "visao" ? "/" + route.tab : ""}`;
  return pages[normalizePage(route.page)].path;
}

export function routeTitle(route: Route) {
  if (route.page === "integration") return "Integração";
  return pages[normalizePage(route.page)].title;
}

export function routeSection(route: Route) {
  if (route.page === "integration") return "Integrações";
  return pages[normalizePage(route.page)].section;
}

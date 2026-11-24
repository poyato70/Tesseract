import { nativePreset, nativePresets, ownSecret } from "../../shared/mcp-catalog.js";
/**
 * Modelo puro das integrações: grafo do mapa vivo, ciclo de vida e linha do
 * tempo. Nenhum valor é estimado; tudo deriva do cadastro, da sessão e dos
 * eventos de diagnóstico que o servidor local registrou.
 */
import type { DiagnosticEvent } from "../../server/diagnostics/service.js";

export type IntegrationProfile = {
  id: string;
  name: string;
  preset: string;
  transport: string;
  endpoint?: string;
  authMode: string;
  accessId?: string;
  audience?: string;
  resourceContext?: Record<string, string>;
  approvedTools?: { name: string; schemaHash: string }[];
  connected?: boolean;
  status?: string;
  tokenConfigured?: boolean;
  allowPrivateNetwork?: boolean;
  configurationVersion?: number;
  capability?: { status?: string; reason?: string };
};

export type ListedTool = {
  name: string;
  description?: string;
  approved?: boolean;
  reviewable?: boolean;
  inputSchema?: unknown;
  schemaHash?: string;
  _meta?: Record<string, unknown>;
};

export type NodeState = "online" | "ready" | "pending" | "error" | "idle";
export type NodeKind = "client" | "service" | "mcp" | "identity" | "target";

export type GraphNode = {
  id: NodeKind;
  title: string;
  subtitle: string;
  state: NodeState;
  stateLabel: string;
  detail: string;
};

export type GraphEdge = {
  id: string;
  from: NodeKind;
  to: NodeKind;
  step: number;
  label: string;
  note?: string;
  /** Caminho de retorno, desenhado tracejado em volta do diagrama. */
  returnPath?: boolean;
};

export type GraphContext = {
  origin: string;
  serviceOnline: boolean;
  accessName?: string;
  identityActive: boolean;
  events: DiagnosticEvent[];
  running?: boolean;
  lastResult?: LastResult;
};

export type LastResult = {
  ok: boolean;
  at: string;
  tool: string;
  durationMs?: number;
  count?: number;
  message?: string;
};

export const independentPresets = nativePresets.filter((n) => n.independent).map((n) => n.id);

export function isAdvisorProfile(p?: Pick<IntegrationProfile, "preset" | "transport" | "resourceContext">) {
  return p?.preset === "azure" && p.transport === "stdio" && p.resourceContext?.namespace === "advisor";
}

export function providerLabel(p: Pick<IntegrationProfile, "preset">) {
  if (["azure", "adx", "arm", "foundry"].includes(p.preset)) return "Microsoft Azure";
  if (["fabric", "powerbi"].includes(p.preset)) return "Microsoft Fabric";
  return nativePreset(p.preset)?.provider || "Personalizado";
}

export function displayName(p: IntegrationProfile) {
  if (isAdvisorProfile(p)) return p.name || "Azure Advisor";
  return p.name;
}

function hostOf(endpoint?: string) {
  try {
    return endpoint ? new URL(endpoint).host : "";
  } catch {
    return endpoint || "";
  }
}

export function mcpServerLabel(p: IntegrationProfile) {
  const native = nativePreset(p.preset);
  if (native?.runner) {
    const pkg = native.runner.args.filter((a) => !a.startsWith("-") && !["run"].includes(a)).slice(-1)[0] || native.runner.command;
    return { title: pkg.replace(/^awslabs\./, "").replace(/^ghcr\.io\//, ""), subtitle: `Processo local · ${native.runner.command}` };
  }
  if (p.transport === "stdio")
    return p.preset === "fabric"
      ? { title: "fabric-mcp 1.7.0", subtitle: "Processo local · STDIO" }
      : { title: "azmcp 3.0.0", subtitle: `Processo local · grupo ${p.resourceContext?.namespace || "padrão"}` };
  return { title: hostOf(p.endpoint) || "Servidor MCP", subtitle: "Servidor remoto · HTTPS" };
}

export function targetLabel(p: IntegrationProfile) {
  const ctx = p.resourceContext || {};
  if (isAdvisorProfile(p))
    return { title: "Azure Resource Graph", subtitle: "tabela advisorresources", detail: "O azmcp consulta a tabela advisorresources por HTTPS em management.azure.com, no escopo da assinatura vinculada." };
  switch (p.preset) {
    case "azure":
      return { title: "APIs Microsoft Azure", subtitle: `grupo ${ctx.namespace || "padrão"}`, detail: "O servidor oficial chama as APIs Azure do grupo de tools carregado." };
    case "arm":
      return { title: "Azure Resource Manager", subtitle: ctx.scope ? "escopo definido" : "escopo a definir", detail: "Consultas de Cost Management e preços via ARM MCP, limitadas ao escopo escolhido." };
    case "adx":
      return { title: "Azure Data Explorer", subtitle: hostOf(ctx.clusterUri) || "cluster a definir", detail: "Consultas KQL no cluster e banco autorizados." };
    case "foundry":
      return { title: "Microsoft Foundry", subtitle: "projeto autorizado", detail: "Recursos do Foundry acessados pelo MCP remoto." };
    case "fabric":
    case "powerbi":
      return { title: p.preset === "powerbi" ? "Power BI" : "Microsoft Fabric", subtitle: ctx.modelId || ctx.workspaceId || "workspace a definir", detail: "APIs Microsoft Fabric no workspace ou modelo autorizado." };
    case "github":
    case "github-local":
      return { title: "API do GitHub", subtitle: hostOf(p.endpoint) || "GitHub Enterprise", detail: "Repositórios, issues e PRs que o token permite. As permissões do token limitam o que o servidor enxerga." };
    case "mslearn":
      return { title: "Microsoft Learn", subtitle: "documentação pública", detail: "Busca e leitura de artigos e exemplos oficiais. Sem dados da sua empresa." };
    case "aws-knowledge":
      return { title: "AWS Knowledge", subtitle: "documentação pública", detail: "Documentação, disponibilidade regional e boas práticas AWS." };
    case "aws-billing":
    case "aws-pricing":
      return { title: p.preset === "aws-pricing" ? "AWS Pricing API" : "AWS Billing APIs", subtitle: p.preset === "aws-pricing" ? "preços públicos" : "Cost Explorer · Budgets · Optimizer", detail: "O processo local usa as credenciais AWS cadastradas para chamar as APIs de billing da conta." };
    case "gcp-bigquery":
      return { title: "BigQuery", subtitle: "export de billing", detail: "Consultas no projeto e datasets que a conta do token pode ler." };
    case "openshift":
      return { title: "Cluster OpenShift", subtitle: "via kubeconfig local", detail: "O servidor lê o cluster com o contexto do kubeconfig informado, em modo somente leitura." };
    case "kubernetes":
      return { title: "Cluster Kubernetes", subtitle: "acessado pelo servidor MCP", detail: "O acesso ao cluster é configurado no próprio servidor MCP; o Tesseract não recebe credenciais do cluster." };
    default:
      return { title: "Recursos do servidor", subtitle: "definidos pelo servidor MCP", detail: "O que o servidor consulta depende da implementação dele. Revise as tools antes de aprovar." };
  }
}

export function needsIdentity(p: IntegrationProfile) {
  return p.authMode !== "none";
}

export function identityReady(p: IntegrationProfile, identityActive: boolean) {
  if (p.authMode === "none") return true;
  if (ownSecret(p.authMode)) return !!p.tokenConfigured;
  return identityActive;
}

/** Último request de execução (tools/call) desta conexão nos eventos da sessão. */
export function lastExecution(events: DiagnosticEvent[], connectionId: string) {
  const callOp = `POST /api/mcp-connections/${connectionId}/call`;
  const http = [...events].reverse().find((e) => e.operation === callOp && e.requestId);
  if (!http) return undefined;
  const related = events
    .filter((e) => e.requestId === http.requestId)
    .sort((a, b) => a.time.localeCompare(b.time));
  const ok = related.some((e) => e.source === "MCP" && e.status === "sucesso") && /^2/.test(http.status);
  const failed = !ok && (related.some((e) => e.status === "mcp_tool_failed") || /^[45]/.test(http.status));
  const first = Date.parse(related[0].time);
  const last = Date.parse(related[related.length - 1].time);
  return {
    requestId: http.requestId!,
    ok,
    failed,
    at: http.time,
    spanMs: Number.isFinite(first) && Number.isFinite(last) ? last - first : undefined,
    events: related,
  };
}

/** Eventos desta conexão, mais recentes primeiro. */
export function connectionEvents(events: DiagnosticEvent[], p: IntegrationProfile) {
  const path = `/api/mcp-connections/${p.id}`;
  const requestIds = new Set(
    events.filter((e) => e.operation.includes(path) && e.requestId).map((e) => e.requestId),
  );
  return events
    .filter((e) => e.operation.includes(path) || (e.requestId && requestIds.has(e.requestId)))
    .sort((a, b) => b.time.localeCompare(a.time));
}

export function sessionMetrics(events: DiagnosticEvent[], connectionId: string) {
  const callOp = `POST /api/mcp-connections/${connectionId}/call`;
  const calls = events.filter((e) => e.operation === callOp);
  const ok = calls.filter((c) =>
    /^2/.test(c.status) && events.some((e) => e.requestId === c.requestId && e.source === "MCP" && e.status === "sucesso"),
  ).length;
  return { executions: calls.length, successes: ok, failures: calls.length - ok };
}

export type Stage = { id: string; label: string; done: boolean; hint: string; tab: "configuracao" | "testar" | "visao" | "credenciais" };

export function lifecycle(p: IntegrationProfile, ctx: { identityActive: boolean; events: DiagnosticEvent[] }) {
  const exec = lastExecution(ctx.events, p.id);
  const stages: Stage[] = [
    { id: "config", label: "Configurar", done: true, hint: "Cadastro salvo.", tab: "configuracao" },
    {
      id: "identity",
      label: "Autenticar",
      done: identityReady(p, ctx.identityActive),
      hint: p.authMode === "none"
        ? "Endpoint sem autenticação."
        : p.authMode === "bearer"
          ? "Informe o token do endpoint em Configuração."
          : p.authMode === "env"
            ? "Informe as variáveis de credencial em Configuração."
            : p.authMode === "serviceAccount"
              ? "Cole a chave da conta de serviço em Configuração."
          : "Ative a credencial vinculada nesta sessão.",
      tab: ownSecret(p.authMode) ? "configuracao" : "credenciais",
    },
    { id: "connect", label: "Conectar", done: !!p.connected || (p.approvedTools?.length || 0) > 0, hint: "Conecte e liste as tools do servidor.", tab: "testar" },
    { id: "approve", label: "Aprovar", done: (p.approvedTools?.length || 0) > 0, hint: "Aprove ao menos uma tool de leitura.", tab: "testar" },
    { id: "run", label: "Executar", done: !!exec?.ok, hint: "Execute uma tool aprovada.", tab: "testar" },
  ];
  const next = stages.find((s) => !s.done);
  return { stages, done: stages.filter((s) => s.done).length, total: stages.length, next };
}

export function buildGraph(p: IntegrationProfile, ctx: GraphContext) {
  const stdio = p.transport === "stdio";
  const exec = lastExecution(ctx.events, p.id);
  const server = mcpServerLabel(p);
  const target = targetLabel(p);
  const idReady = identityReady(p, ctx.identityActive);
  const failed = ctx.lastResult ? !ctx.lastResult.ok : exec?.failed;
  const succeeded = ctx.lastResult ? ctx.lastResult.ok : exec?.ok;
  const nodes: GraphNode[] = [
    {
      id: "client",
      title: "Navegador",
      subtitle: "Seu computador",
      state: "online",
      stateLabel: "Online",
      detail: `Você abriu o Tesseract em ${ctx.origin}. O navegador só conversa com o serviço local.`,
    },
    {
      id: "service",
      title: `Tesseract ${ctx.origin.replace(/^https?:\/\/[^:]+/, "") || ""}`.trim(),
      subtitle: "Servidor local",
      state: ctx.serviceOnline ? "online" : "error",
      stateLabel: ctx.serviceOnline ? "Online" : "Sem resposta",
      detail: "Valida sessão, origem e CSRF; confere política, escopo e hash do schema antes de cada chamada. Envia ao MCP apenas a tool escolhida e os argumentos.",
    },
    {
      id: "mcp",
      title: server.title,
      subtitle: server.subtitle,
      state: ctx.running ? "pending" : p.connected ? "online" : "idle",
      stateLabel: ctx.running ? "Executando" : p.connected ? "Conectado" : "Desconectado",
      detail: stdio
        ? "O Tesseract inicia o pacote oficial fixado neste computador e troca mensagens pela entrada/saída do processo (STDIO). Nenhum comando livre é aceito."
        : "O Tesseract conversa por Streamable HTTP com o endpoint cadastrado. Conexão e execução de tool têm estados independentes.",
    },
  ];
  if (needsIdentity(p)) {
    const entra = p.authMode === "application" || p.authMode === "delegated";
    nodes.push({
      id: "identity",
      title: entra ? "Entra ID" : p.authMode === "env" ? "Credenciais locais" : p.authMode === "serviceAccount" ? "Conta de serviço" : "Token Bearer",
      subtitle: entra ? (p.authMode === "application" ? "Identidade de aplicação" : "Login delegado") : "Cofre local (DPAPI)",
      state: idReady ? "online" : "pending",
      stateLabel: idReady ? (entra ? "Ativa nesta sessão" : "Configurado") : entra ? "Ativar credencial" : "Token ausente",
      detail: entra
        ? `${ctx.accessName ? `Credencial: ${ctx.accessName}. ` : "Nenhuma credencial vinculada. "}O token é emitido por login.microsoftonline.com; a permissão de dados é decidida pelo provedor.`
        : p.authMode === "env"
          ? "As variáveis ficam no cofre local e são entregues somente ao processo deste conector, ao iniciar."
          : "O token próprio do endpoint é guardado protegido e enviado apenas a este host.",
    });
  }
  nodes.push({
    id: "target",
    title: target.title,
    subtitle: target.subtitle,
    state: failed ? "error" : succeeded ? "online" : "idle",
    stateLabel: failed ? "Consulta falhou" : succeeded ? "Consulta concluída" : "Sem consulta",
    detail: target.detail,
  });
  const edges: GraphEdge[] = [
    { id: "e1", from: "client", to: "service", step: 1, label: "HTTP local" },
    { id: "e2", from: "service", to: "mcp", step: 2, label: stdio ? "MCP via STDIO" : "MCP via HTTPS" },
  ];
  let step = 3;
  if (needsIdentity(p))
    edges.push({
      id: "e3",
      from: stdio ? "mcp" : "service",
      to: "identity",
      step: step++,
      label: p.authMode === "bearer" ? "Token anexado (HTTPS)" : p.authMode === "env" ? "Variáveis do processo" : "Token de acesso (HTTPS)",
    });
  edges.push({ id: "e4", from: "mcp", to: "target", step: step++, label: "Consulta (HTTPS)" });
  const total = ctx.lastResult?.durationMs ?? exec?.spanMs;
  edges.push({
    id: "e5",
    from: "target",
    to: "client",
    step: step,
    label: "Resultado (volta pelo mesmo caminho)",
    note: [
      total !== undefined ? formatDuration(total) : undefined,
      ctx.lastResult?.count !== undefined ? `${ctx.lastResult.count} itens` : undefined,
    ].filter(Boolean).join(" · ") || undefined,
    returnPath: true,
  });
  return { nodes, edges };
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0).replace(".", ",")} s`;
}

/** Conta itens de um resultado MCP quando o formato é reconhecido. */
export function resultCount(response: any): number | undefined {
  const r = response?.result ?? response;
  const payloads: any[] = [r?.structuredContent];
  for (const c of Array.isArray(r?.content) ? r.content : [])
    if (c?.type === "text" && typeof c.text === "string")
      try {
        payloads.push(JSON.parse(c.text));
      } catch {
        /* texto livre */
      }
  if (r?.presentation && Number.isSafeInteger(r.presentation.count)) return r.presentation.count;
  for (const p of payloads) {
    if (Array.isArray(p?.results?.recommendations)) return p.results.recommendations.length;
    if (Array.isArray(p?.results)) return p.results.length;
    if (Array.isArray(p?.value)) return p.value.length;
    if (Array.isArray(p)) return p.length;
  }
  return undefined;
}

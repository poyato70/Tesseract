/**
 * Topologia operacional: quem está ligado a quem neste Tesseract e o que
 * aconteceu há pouco. Tudo vem do cadastro e do diagnóstico da sessão.
 */
import type { DiagnosticEvent } from "../../server/diagnostics/service.js";
import type { PublicAccessProfile } from "../../shared/connections.js";
import {
  identityReady,
  lastExecution,
  lifecycle,
  mcpServerLabel,
  targetLabel,
  type IntegrationProfile,
} from "../integrations/model.js";
import type { FlowEdge, FlowState } from "./FlowCanvas.js";

export type OpNodeKind = "client" | "hub" | "identity" | "bearer" | "integration" | "apis" | "target";

export type OpNode = {
  id: string;
  kind: OpNodeKind;
  x: number;
  y: number;
  title: string;
  subtitle?: string;
  state: FlowState;
  stateLabel?: string;
  burst?: boolean;
  refId?: string;
  done?: number;
  total?: number;
};

export type OpContext = {
  profiles: IntegrationProfile[];
  accesses: PublicAccessProfile[];
  activeAccessId?: string;
  principalKind?: string;
  authenticated: boolean;
  events: DiagnosticEvent[];
  now: number;
};

const COL = { client: 44, hub: 168, identity: 330, integration: 560, target: 800 };
export const OP_WIDTH = 1010;
const ROW_GAP = 78;

const RUN_MS = 20_000;
const RECENT_MS = 5 * 60_000;
const BURST_MS = 2 * 60_000;

function age(now: number, iso?: string) {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? now - t : Infinity;
}

function pulseFor(now: number, at: string | undefined, failed: boolean): FlowEdge["pulse"] {
  const a = age(now, at);
  if (a > RECENT_MS) return undefined;
  if (failed) return "error";
  return a <= RUN_MS ? "run" : "recent";
}

function spread(count: number, height: number) {
  if (!count) return [];
  const gap = Math.min(ROW_GAP + 8, (height - 70) / Math.max(1, count - 1 || 1));
  const total = gap * (count - 1);
  const start = height / 2 - total / 2;
  return Array.from({ length: count }, (_, i) => start + i * gap);
}

const ownCred = (p: IntegrationProfile) => p.authMode === "bearer" || p.authMode === "env";

export function identityActiveFor(p: IntegrationProfile, ctx: Pick<OpContext, "activeAccessId" | "principalKind">) {
  return !!p.accessId && ctx.activeAccessId === p.accessId && (p.authMode === "application" ? ctx.principalKind === "application" : ctx.principalKind === "user");
}

export function buildOperational(ctx: OpContext) {
  const { now, events } = ctx;
  const list = ctx.profiles.filter((p) => p.id !== "default");
  const lastEventAt = events.length ? events.reduce((m, e) => (e.time > m ? e.time : m), events[0].time) : undefined;

  // ---- identidades usadas (na ordem das integrações para reduzir cruzamentos)
  const identityIds: string[] = [];
  for (const p of list) if (p.accessId && !ownCred(p) && p.authMode !== "none" && !identityIds.includes(p.accessId)) identityIds.push(p.accessId);
  if (ctx.activeAccessId && !identityIds.includes(ctx.activeAccessId)) identityIds.push(ctx.activeAccessId);
  const hasBearer = list.some(ownCred);

  // ---- destinos únicos
  const targets: { key: string; title: string; subtitle: string }[] = [];
  const targetOf = new Map<string, string>();
  for (const p of list) {
    const t = targetLabel(p);
    const key = `t:${t.title}`;
    targetOf.set(p.id, key);
    if (!targets.some((x) => x.key === key)) targets.push({ key, title: t.title, subtitle: t.subtitle });
  }
  const apisTarget = "t:Azure Resource Manager";
  if (!targets.some((t) => t.key === apisTarget)) targets.push({ key: apisTarget, title: "Azure Resource Manager", subtitle: "management.azure.com" });

  const midRows = list.length + 1; // +1 para as APIs nativas
  // altura = conteúdo: sem faixa vazia abaixo do último nó
  const height = Math.max(230, Math.max(midRows, identityIds.length + (hasBearer ? 1 : 0), targets.length) * ROW_GAP + 70);

  const nodes: OpNode[] = [];
  const edges: FlowEdge[] = [];
  const recentAny = age(now, lastEventAt) <= RUN_MS;

  nodes.push({ id: "client", kind: "client", x: COL.client, y: height / 2, title: "Você", subtitle: "Navegador", state: "online", stateLabel: "Sessão local" });
  nodes.push({
    id: "hub",
    kind: "hub",
    x: COL.hub,
    y: height / 2,
    title: "Tesseract",
    subtitle: typeof window !== "undefined" ? window.location.host : "local",
    state: "online",
    stateLabel: "Serviço local",
  });
  edges.push({ id: "client-hub", from: "client", to: "hub", tone: "cyan", pulse: recentAny ? "run" : age(now, lastEventAt) <= RECENT_MS ? "recent" : undefined });

  // identidades
  const idRows = spread(identityIds.length + (hasBearer ? 1 : 0), height);
  identityIds.forEach((id, i) => {
    const a = ctx.accesses.find((x) => x.id === id);
    const active = ctx.authenticated && ctx.activeAccessId === id;
    nodes.push({
      id: `id:${id}`,
      kind: "identity",
      refId: id,
      x: COL.identity,
      y: idRows[i],
      title: a?.name || "Credencial removida",
      subtitle: active ? (ctx.principalKind === "application" ? "Aplicação ativa" : "Usuário ativo") : "Entra ID",
      state: active ? "online" : a ? "idle" : "error",
      stateLabel: active ? "Ativa nesta sessão" : a ? "Inativa" : "Não encontrada",
    });
    edges.push({ id: `hub-id:${id}`, from: "hub", to: `id:${id}`, tone: "blue", pulse: undefined });
  });
  if (hasBearer) {
    const ok = list.filter(ownCred).every((p) => p.tokenConfigured);
    nodes.push({ id: "bearer", kind: "bearer", x: COL.identity, y: idRows[identityIds.length], title: "Tokens e chaves", subtitle: "Cofre local", state: ok ? "online" : "pending", stateLabel: ok ? "Configurado" : "Token ausente" });
    edges.push({ id: "hub-bearer", from: "hub", to: "bearer", tone: "amber" });
  }

  // integrações + APIs nativas
  const midY = spread(midRows, height);
  list.forEach((p, i) => {
    const exec = lastExecution(events, p.id);
    const idActive = identityActiveFor(p, ctx);
    const life = lifecycle(p, { identityActive: idActive, events });
    const running = age(now, exec?.at) <= RUN_MS && !exec?.failed;
    const state: FlowState = running ? "active" : exec?.failed && age(now, exec.at) <= RECENT_MS ? "error" : p.connected ? "online" : life.next?.id === "identity" ? "pending" : "idle";
    nodes.push({
      id: `int:${p.id}`,
      kind: "integration",
      refId: p.id,
      x: COL.integration,
      y: midY[i],
      title: p.name,
      subtitle: mcpServerLabel(p).title,
      state,
      stateLabel: running ? "Executando agora" : exec?.failed && state === "error" ? "Última execução falhou" : life.next ? `Próximo: ${life.next.label}` : p.connected ? "Conectada" : "Pronta",
      done: life.done,
      total: life.total,
    });
    const source = ownCred(p) ? "bearer" : p.authMode === "none" || !p.accessId ? "hub" : `id:${p.accessId}`;
    const pulse = pulseFor(now, exec?.at, !!exec?.failed);
    edges.push({ id: `${source}-int:${p.id}`, from: source, to: `int:${p.id}`, tone: "teal", pulse, dashed: !identityReady(p, idActive) });
    edges.push({ id: `int:${p.id}-${targetOf.get(p.id)}`, from: `int:${p.id}`, to: targetOf.get(p.id)!, tone: "purple", pulse });
    // a origem da identidade também acende quando há execução
    const idEdge = edges.find((e) => e.to === source && e.from === "hub");
    if (idEdge && pulse && !idEdge.pulse) idEdge.pulse = pulse === "error" ? "recent" : pulse;
  });
  const apiEvents = events.filter((e) => e.source === "Aplicação local" && /^(GET|POST) \/api\/(costs|forecast|budgets|benefits|tags|ai-usage|hubs|azure)/.test(e.operation));
  const lastApi = apiEvents.length ? apiEvents.reduce((m, e) => (e.time > m.time ? e : m)) : undefined;
  const apiFailed = !!lastApi && /^[45]/.test(lastApi.status);
  nodes.push({
    id: "apis",
    kind: "apis",
    x: COL.integration,
    y: midY[list.length],
    title: "APIs Azure nativas",
    subtitle: "Cost Management · Consumption · Budgets",
    state: ctx.authenticated ? (apiFailed && age(now, lastApi?.time) <= RECENT_MS ? "error" : "online") : "idle",
    stateLabel: ctx.authenticated ? "Disponíveis" : "Requer credencial",
  });
  const apiSource = ctx.authenticated && ctx.activeAccessId ? `id:${ctx.activeAccessId}` : "hub";
  const apiPulse = pulseFor(now, lastApi?.time, apiFailed);
  edges.push({ id: `${apiSource}-apis`, from: apiSource, to: "apis", tone: "cyan", pulse: apiPulse, dashed: !ctx.authenticated });
  edges.push({ id: "apis-arm", from: "apis", to: apisTarget, tone: "purple", pulse: apiPulse });

  // destinos
  const tRows = spread(targets.length, height);
  targets.forEach((t, i) => {
    const linked = list.filter((p) => targetOf.get(p.id) === t.key);
    const execs = linked.map((p) => lastExecution(events, p.id)).filter(Boolean);
    const latest = execs.sort((a, b) => b!.at.localeCompare(a!.at))[0];
    const viaApi = t.key === apisTarget && lastApi && (!latest || lastApi.time > latest.at);
    const ok = viaApi ? !apiFailed : latest?.ok;
    const failed = viaApi ? apiFailed : latest?.failed;
    const at = viaApi ? lastApi!.time : latest?.at;
    nodes.push({
      id: t.key,
      kind: "target",
      x: COL.target,
      y: tRows[i],
      title: t.title,
      subtitle: t.subtitle,
      state: failed && age(now, at) <= RECENT_MS ? "error" : ok ? "online" : "idle",
      stateLabel: failed ? "Última consulta falhou" : ok ? "Consulta concluída" : "Sem consulta",
      burst: !!ok && age(now, at) <= BURST_MS,
    });
  });

  return { nodes, edges, width: OP_WIDTH, height };
}

/** Eventos por minuto, do mais antigo ao mais recente. */
export function activityBuckets(events: DiagnosticEvent[], now: number, minutes = 15) {
  const buckets = Array.from({ length: minutes }, (_, i) => ({ start: now - (minutes - i) * 60_000, total: 0, calls: 0, errors: 0 }));
  for (const e of events) {
    const t = Date.parse(e.time);
    const idx = Math.floor((t - (now - minutes * 60_000)) / 60_000);
    if (idx < 0 || idx >= minutes) continue;
    const b = buckets[idx];
    b.total++;
    if (/\/mcp-connections\/[^/]+\/call$/.test(e.operation)) b.calls++;
    if (/^[45]/.test(e.status) || /failed|falh/i.test(e.status)) b.errors++;
  }
  return buckets;
}

export function callSuccess(events: DiagnosticEvent[]) {
  const calls = events.filter((e) => /^POST \/api\/mcp-connections\/[^/]+\/call$/.test(e.operation));
  const ok = calls.filter((c) => /^2/.test(c.status) && events.some((e) => e.requestId === c.requestId && e.source === "MCP" && e.status === "sucesso")).length;
  return { total: calls.length, ok };
}

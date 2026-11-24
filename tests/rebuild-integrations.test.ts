import { describe, expect, it } from "vitest";
import { formatPath, normalizePage, parsePath } from "../src/web/shell/routes.js";
import {
  buildGraph,
  connectionEvents,
  lastExecution,
  lifecycle,
  resultCount,
  sessionMetrics,
  type IntegrationProfile,
} from "../src/web/integrations/model.js";

const id = "11111111-2222-3333-4444-555555555555";
const advisor: IntegrationProfile = {
  id,
  name: "Azure Advisor",
  preset: "azure",
  transport: "stdio",
  authMode: "application",
  accessId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  resourceContext: { namespace: "advisor", subscription: "00000000-0000-0000-0000-000000000000" },
  approvedTools: [],
  connected: false,
};
const ev = (time: string, requestId: string, source: string, operation: string, status: string) => ({ time, requestId, source, operation, status, detail: "" });

describe("rotas do rebuild", () => {
  it("mantém endereços da missão 21 e leva o Inspetor para a aba Testar", () => {
    expect(parsePath(`/conexoes/inspetor/${id}`)).toEqual({ page: "integration", connectionId: id, tab: "testar" });
    expect(parsePath(`/conexoes/integracao/${id}`)).toEqual({ page: "integration", connectionId: id, tab: "visao" });
    expect(parsePath("/conexoes/catalogo")).toEqual({ page: "catalog" });
    expect(parsePath("/new_features_ux")).toEqual({ page: "new_features_ux" });
  });
  it("formata e reconhece as rotas novas", () => {
    expect(formatPath({ page: "integration", connectionId: id, tab: "visao" })).toBe(`/integracoes/${id}`);
    expect(formatPath({ page: "integration", connectionId: id, tab: "testar" })).toBe(`/integracoes/${id}/testar`);
    expect(parsePath(`/integracoes/${id}/configuracao`)).toMatchObject({ tab: "configuracao" });
    expect(parsePath("/integracoes/catalogo")).toEqual({ page: "catalog" });
    expect(parsePath("/finops/custos/")).toEqual({ page: "costs" });
    expect(parsePath("/qualquer")).toEqual({ page: "home" });
  });
  it("traduz ids antigos emitidos pelas páginas reaproveitadas", () => {
    expect(normalizePage("mcps")).toBe("integrations");
    expect(normalizePage("discovery")).toBe("catalog");
    expect(normalizePage("accesses")).toBe("accesses");
  });
});

describe("modelo da integração", () => {
  it("indica o próximo passo do ciclo de vida", () => {
    expect(lifecycle(advisor, { identityActive: false, events: [] }).next?.id).toBe("identity");
    expect(lifecycle(advisor, { identityActive: true, events: [] }).next?.id).toBe("connect");
    const ready = { ...advisor, connected: true, approvedTools: [{ name: "advisor_recommendation_list", schemaHash: "x" }] };
    expect(lifecycle(ready, { identityActive: true, events: [] }).next?.id).toBe("run");
  });
  it("não exige identidade de endpoints sem autenticação", () => {
    const custom = { ...advisor, preset: "custom", transport: "http", authMode: "none", accessId: undefined };
    const g = buildGraph(custom, { origin: "http://127.0.0.1:4317", serviceOnline: true, identityActive: false, events: [] });
    expect(g.nodes.map((n) => n.id)).toEqual(["client", "service", "mcp", "target"]);
    expect(g.edges.map((e) => e.step)).toEqual([1, 2, 3, 4]);
  });
  it("monta o caminho do Advisor com Entra ID e Resource Graph", () => {
    const g = buildGraph(advisor, { origin: "http://127.0.0.1:4317", serviceOnline: true, identityActive: true, events: [] });
    expect(g.nodes.find((n) => n.id === "target")?.title).toBe("Azure Resource Graph");
    expect(g.nodes.find((n) => n.id === "identity")?.state).toBe("online");
    expect(g.edges.at(-1)).toMatchObject({ step: 5, returnPath: true });
    expect(g.edges.at(-1)?.note).toBeUndefined();
  });
  it("deriva a última execução apenas dos eventos registrados", () => {
    const call = `POST /api/mcp-connections/${id}/call`;
    const events = [
      ev("2026-11-24T10:00:00.000Z", "r1", "MCP", "Azure Advisor / advisor_recommendation_list", "validando"),
      ev("2026-11-24T10:00:01.200Z", "r1", "MCP", "Azure Advisor / advisor_recommendation_list", "sucesso"),
      ev("2026-11-24T10:00:01.250Z", "r1", "Aplicação local", call, "200"),
      ev("2026-11-24T10:01:00.000Z", "r2", "Aplicação local", call, "502"),
      ev("2026-11-24T09:59:00.000Z", "r0", "Aplicação local", `POST /api/mcp-connections/${id}/test`, "200"),
      ev("2026-11-24T09:59:00.000Z", "z", "Aplicação local", "POST /api/costs/query", "200"),
    ];
    const last = lastExecution(events, id)!;
    expect(last.requestId).toBe("r2");
    expect(last.failed).toBe(true);
    expect(lastExecution(events.slice(0, 3), id)).toMatchObject({ ok: true, spanMs: 1250 });
    expect(sessionMetrics(events, id)).toEqual({ executions: 2, successes: 1, failures: 1 });
    expect(connectionEvents(events, advisor)).toHaveLength(5);
  });
  it("conta itens apenas em formatos reconhecidos", () => {
    const text = JSON.stringify({ results: { recommendations: [{}, {}, {}] } });
    expect(resultCount({ result: { content: [{ type: "text", text }] } })).toBe(3);
    expect(resultCount({ result: { content: [{ type: "text", text: "livre" }] } })).toBeUndefined();
  });
});

import { activityBuckets, buildOperational, callSuccess } from "../src/web/flow/operational.js";

describe("topologia operacional", () => {
  const now = Date.parse("2026-11-24T10:00:30.000Z");
  const call = `POST /api/mcp-connections/${id}/call`;
  const events = [
    ev("2026-11-24T10:00:10.000Z", "r1", "MCP", "Azure Advisor / advisor_recommendation_list", "validando"),
    ev("2026-11-24T10:00:11.000Z", "r1", "MCP", "Azure Advisor / advisor_recommendation_list", "sucesso"),
    ev("2026-11-24T10:00:11.100Z", "r1", "Aplicação local", call, "200"),
  ];
  const base = {
    profiles: [advisor],
    accesses: [{ id: advisor.accessId!, name: "App FinOps", preferredMode: "application" } as any],
    activeAccessId: advisor.accessId,
    principalKind: "application",
    authenticated: true,
    now,
  };
  it("liga credencial, integração e destino e acende só onde houve execução", () => {
    const op = buildOperational({ ...base, events });
    expect(op.nodes.map((n) => n.kind)).toEqual(["client", "hub", "identity", "integration", "apis", "target", "target"]);
    const intoInt = op.edges.find((e) => e.to === `int:${id}`)!;
    expect(intoInt.from).toBe(`id:${advisor.accessId}`);
    expect(intoInt.pulse).toBe("run");
    expect(op.edges.find((e) => e.id === "apis-arm")?.pulse).toBeUndefined();
    expect(op.nodes.find((n) => n.id === "t:Azure Resource Graph")).toMatchObject({ state: "online", burst: true });
  });
  it("sem eventos não há pulsos e a credencial inativa fica tracejada", () => {
    const op = buildOperational({ ...base, events: [], activeAccessId: undefined, authenticated: false });
    expect(op.edges.every((e) => !e.pulse)).toBe(true);
    expect(op.edges.find((e) => e.to === `int:${id}`)?.dashed).toBe(true);
    expect(op.nodes.find((n) => n.id === "apis")?.state).toBe("idle");
  });
  it("agrupa eventos por minuto e mede o sucesso das execuções", () => {
    const b = activityBuckets(events, now, 15);
    expect(b).toHaveLength(15);
    expect(b[14]).toMatchObject({ total: 3, calls: 1, errors: 0 });
    expect(callSuccess(events)).toEqual({ total: 1, ok: 1 });
  });
});

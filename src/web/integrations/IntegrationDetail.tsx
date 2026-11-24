import { CopilotExport } from "./CopilotExport.js";
import { ConnectionExplainer } from "./ConnectionExplainer.js";
import { TesseractLoader } from "../flow/TesseractLoader.js";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  Play,
  RefreshCw,
  Settings2,
  Workflow,
  XCircle,
  Clock3,
} from "lucide-react";
import type { DiagnosticEvent } from "../../server/diagnostics/service.js";
import type { PublicAccessProfile } from "../../shared/connections.js";
import { advisorListArguments, advisorListTool } from "../../shared/advisor-quick-start.js";
import { manageRequest } from "../api.js";
import type { IntegrationTab } from "../shell/routes.js";
import { LiveDiagram, Ring } from "./LiveDiagram.js";
import { IntegrationForm } from "./IntegrationForm.js";
import { ToolTester, runTool, defaultArguments } from "./ToolTester.js";
import {
  buildGraph,
  connectionEvents,
  formatDuration,
  identityReady,
  isAdvisorProfile,
  lastExecution,
  lifecycle,
  mcpServerLabel,
  providerLabel,
  sessionMetrics,
  targetLabel,
  type IntegrationProfile,
  type LastResult,
  type ListedTool,
  type NodeKind,
} from "./model.js";

const tabs: { id: IntegrationTab; label: string; Icon: typeof Workflow }[] = [
  { id: "visao", label: "Visão de integração", Icon: Workflow },
  { id: "testar", label: "Testar", Icon: FlaskConical },
  { id: "configuracao", label: "Configuração", Icon: Settings2 },
  { id: "atividade", label: "Atividade", Icon: Activity },
];

function docLinks(p: IntegrationProfile): [string, string][] {
  if (isAdvisorProfile(p))
    return [
      ["Tools do Azure Advisor no Azure MCP", "https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/tools/azure-advisor"],
      ["API Resource Graph (resources)", "https://learn.microsoft.com/en-us/rest/api/azureresourcegraph/resourcegraph/resources/resources"],
      ["Repositório Microsoft MCP", "https://github.com/microsoft/mcp"],
      ["Portal Azure", "https://portal.azure.com"],
    ];
  if (p.preset === "arm")
    return [
      ["Cost Management e Pricing no ARM MCP", "https://github.com/Azure/Azure-Resource-Manager-MCP/blob/main/docs/CostManagementAndPricingTools.md"],
      ["Portal Azure", "https://portal.azure.com"],
    ];
  if (["fabric", "powerbi"].includes(p.preset))
    return [["MCP remoto do Power BI / Fabric", "https://learn.microsoft.com/power-bi/developer/mcp/remote-mcp-server-get-started"]];
  if (["azure", "adx", "foundry"].includes(p.preset)) return [["Repositório Microsoft MCP", "https://github.com/microsoft/mcp"]];
  return [["Especificação Model Context Protocol", "https://modelcontextprotocol.io"]];
}

const authLabel: Record<string, string> = {
  env: "Variáveis de credencial (cofre local)",
  application: "Entra ID · identidade de aplicação",
  delegated: "Entra ID · login delegado",
  bearer: "Token Bearer próprio",
  none: "Sem autenticação",
};

export function IntegrationDetail({
  profile,
  profiles,
  tab,
  onTab,
  accesses,
  events,
  activeAccessId,
  principalKind,
  azureAuthenticated,
  identityActive,
  onRefresh,
  refreshing,
  onConnectIdentity,
  onOpenAccesses,
  onDeleted,
}: {
  profile: IntegrationProfile;
  profiles: IntegrationProfile[];
  tab: IntegrationTab;
  onTab: (tab: IntegrationTab) => void;
  accesses: PublicAccessProfile[];
  events: DiagnosticEvent[];
  activeAccessId?: string;
  principalKind?: string;
  azureAuthenticated: boolean;
  identityActive: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  onConnectIdentity: (p: IntegrationProfile) => void;
  onOpenAccesses: () => void;
  onDeleted: () => void;
}) {
  const [tools, setTools] = useState<ListedTool[]>();
  const [running, setRunningRaw] = useState(false);
  const runStarted = useRef(0);
  // Mantém a animação visível por ~1,6 s mesmo quando a chamada é muito rápida;
  // a duração real continua vindo do servidor (linha do tempo e métricas).
  const setRunning = (v: boolean) => {
    if (v) {
      runStarted.current = Date.now();
      return setRunningRaw(true);
    }
    const left = 1600 - (Date.now() - runStarted.current);
    if (left > 0) setTimeout(() => setRunningRaw(false), left);
    else setRunningRaw(false);
  };
  const [lastResult, setLastResult] = useState<LastResult>();
  const [lastDisplay, setLastDisplay] = useState<any>();
  const [selected, setSelected] = useState<NodeKind>("mcp");
  const [runError, setRunError] = useState("");
  const [sideTab, setSideTab] = useState<"geral" | "no">("geral");
  const accessName = accesses.find((a) => a.id === profile.accessId)?.name;
  const idReady = identityReady(profile, identityActive);

  // Se a sessão MCP já estiver aberta, carrega a lista de tools sem reconectar.
  useEffect(() => {
    if (!profile.connected || tools) return;
    const c = new AbortController();
    manageRequest(`/mcp-connections/${profile.id}/tools`, "GET", undefined, c.signal)
      .then((list) => !c.signal.aborted && Array.isArray(list) && setTools(list))
      .catch(() => undefined);
    return () => c.abort();
  }, [profile.id, profile.connected]);

  const graph = useMemo(
    () =>
      buildGraph(profile, {
        origin: window.location.origin,
        serviceOnline: true,
        accessName,
        identityActive,
        events,
        running,
        lastResult,
      }),
    [profile, accessName, identityActive, events, running, lastResult],
  );
  const life = lifecycle(profile, { identityActive, events });
  const exec = lastExecution(events, profile.id);
  const metrics = sessionMetrics(events, profile.id);
  const server = mcpServerLabel(profile);
  const target = targetLabel(profile);
  const node = graph.nodes.find((n) => n.id === selected) || graph.nodes[2];
  const live = running || !!lastResult?.ok || !!exec?.ok;
  const lastAt = lastResult?.at || exec?.at;
  const lastOk = lastResult ? lastResult.ok : exec?.ok;
  const mainTool =
    (tools || []).find((t) => t.approved && (!isAdvisorProfile(profile) || advisorListTool.test(t.name)))?.name ||
    profile.approvedTools?.[0]?.name ||
    (isAdvisorProfile(profile) ? "advisor_recommendation_list" : "—");

  function recordResult(summary: LastResult, display?: any) {
    setLastResult(summary);
    if (display) setLastDisplay(display);
  }

  /** Executar agora: conecta se preciso, aprova a leitura guiada do Advisor e executa. */
  async function runNow() {
    setRunError("");
    if (!idReady) {
      setSelected("identity");
      setRunError("Ative a credencial desta integração antes de executar.");
      return;
    }
    setRunning(true);
    try {
      let list = tools;
      if (!list) {
        const r = await manageRequest(`/mcp-connections/${profile.id}/test`, "POST", {});
        list = Array.isArray(r?.tools) ? (r.tools as ListedTool[]) : [];
        setTools(list);
      }
      let tool = list.find((t) => t.name === lastResult?.tool && t.approved) || list.find((t) => t.approved);
      if (isAdvisorProfile(profile)) {
        const advisorTool = list.find((t) => advisorListTool.test(t.name) && advisorListArguments(t as any, profile.resourceContext?.subscription || ""));
        if (advisorTool && !advisorTool.approved) {
          await manageRequest(`/mcp-connections/${profile.id}/approve-tools`, "POST", { names: [advisorTool.name], advisorSchemaHash: advisorTool.schemaHash });
          list = list.map((t) => (t.name === advisorTool.name ? { ...t, approved: true } : t));
          setTools(list);
        }
        tool = advisorTool ? { ...advisorTool, approved: true } : tool;
      }
      if (!tool || tool._meta?.["tesseract/approval"] === "each-call") {
        setRunning(false);
        onTab("testar");
        return;
      }
      const { display, summary } = await runTool(profile, tool, defaultArguments(profile, tool), isAdvisorProfile(profile));
      recordResult(summary, display);
    } catch (e) {
      const message = (e as Error).message;
      setRunError(message);
      setLastResult({ ok: false, at: new Date().toISOString(), tool: mainTool, message });
    } finally {
      setRunning(false);
      onRefresh();
    }
  }

  const nodeAction = (n: (typeof graph.nodes)[number]) => {
    if (n.id === "mcp") return { label: "Tools", onClick: () => onTab("testar") };
    if (n.id === "identity")
      return idReady || profile.authMode === "bearer"
        ? { label: profile.authMode === "bearer" ? "Configurar" : "Credenciais", onClick: () => (profile.authMode === "bearer" ? onTab("configuracao") : onOpenAccesses()) }
        : { label: "Ativar", onClick: () => onConnectIdentity(profile) };
    if (n.id === "target") return { label: "Detalhes", onClick: () => onTab("atividade") };
    if (n.id === "service") return { label: "Detalhes", onClick: () => setSelected("service") };
    return undefined;
  };

  return (
    <div className="idt">
      <header className="idt-head">
        <span className="idt-icon" aria-hidden="true">
          <Workflow size={26} />
        </span>
        <div className="idt-heading">
          <h1>
            {profile.name}
            <span className={`idt-pill is-${profile.connected ? "online" : "idle"}`}>
              <i aria-hidden="true" /> {profile.connected ? "Ativa" : "Desconectada"}
            </span>
          </h1>
          <p>Mapa vivo da integração · monitore, explore e teste cada componente desta integração.</p>
        </div>
        <div className="idt-run">
          <span className={`idt-last ${lastAt ? (lastOk ? "is-ok" : "is-error") : ""}`}>
            <i aria-hidden="true" />
            {lastAt ? `Última execução: ${new Date(lastAt).toLocaleString("pt-BR")}` : "Sem execução nesta sessão"}
          </span>
          <button type="button" className="lx-btn lx-btn--primary lx-btn--lg" disabled={running} onClick={() => void runNow()}>
            {running ? <TesseractLoader size={16} /> : <Play size={15} aria-hidden="true" />} {running ? "Executando…" : "Executar agora"}
          </button>
        </div>
      </header>
      {runError && (
        <p className="tt-notice is-error" role="alert">
          {runError}
        </p>
      )}

      <nav className="idt-tabs" aria-label="Seções da integração">
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => onTab(id)}>
            <Icon size={15} aria-hidden="true" /> {label}
          </button>
        ))}
        <a className="idt-tab-link" href={docLinks(profile)[0][1]} target="_blank" rel="noreferrer">
          <BookOpen size={15} aria-hidden="true" /> Documentação
        </a>
      </nav>

      {tab === "visao" && (
        <>
          <div className="idt-main">
            <div className="idt-left">
              <section className="idt-canvas" aria-label="Diagrama">
                <LiveDiagram
                  nodes={graph.nodes}
                  edges={graph.edges}
                  selected={selected}
                  onSelect={(id) => {
                    setSelected(id);
                    setSideTab("no");
                  }}
                  live={live}
                  running={running}
                  tools={tools || (profile.approvedTools || []).map((t) => ({ name: t.name, approved: true, reviewable: true }))}
                  failed={lastResult ? !lastResult.ok : !!exec?.failed}
                  onOpenTools={() => onTab("testar")}
                />
              </section>
              <div className="idt-cards">
                <section className="idt-card">
                  <h3>Última execução</h3>
                  {lastAt ? (
                    <div className={`idt-result ${lastOk ? "is-ok" : "is-error"}`}>
                      {lastOk ? <CheckCircle2 size={30} aria-hidden="true" /> : <XCircle size={30} aria-hidden="true" />}
                      <span>
                        <strong>{lastOk ? "Concluída com sucesso" : "Falhou"}</strong>
                        <small>{new Date(lastAt).toLocaleString("pt-BR")}</small>
                      </span>
                    </div>
                  ) : (
                    <p className="idt-empty">Nenhuma execução nesta sessão. Use “Executar agora” ou a aba Testar.</p>
                  )}
                  {lastResult?.count !== undefined && (
                    <p className="idt-big">
                      <b>{lastResult.count}</b> itens retornados
                    </p>
                  )}
                  {lastResult?.message && !lastResult.ok && <p className="idt-empty">{lastResult.message}</p>}
                  <button type="button" className="lx-btn lx-btn--block" onClick={() => onTab(lastDisplay ? "testar" : "atividade")}>
                    Ver detalhes da execução →
                  </button>
                </section>

                <section className="idt-card">
                  <h3>Linha do tempo da execução</h3>
                  {exec ? (
                    <ol className="idt-timeline">
                      {exec.events.map((e, i) => {
                        const prev = i ? Date.parse(exec.events[i - 1].time) : undefined;
                        const delta = prev !== undefined ? Date.parse(e.time) - prev : undefined;
                        const ok = !/^[45]|falh|failed/i.test(e.status);
                        return (
                          <li key={i} className={ok ? "is-ok" : "is-error"}>
                            <i aria-hidden="true" />
                            <time>{new Date(e.time).toLocaleTimeString("pt-BR")}</time>
                            <span>
                              {e.source === "MCP" ? `MCP · ${e.status}` : `${e.operation.split(" ")[0]} · HTTP ${e.status}`}
                            </span>
                            <small>{delta !== undefined ? `+${formatDuration(delta)}` : "início"}</small>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="idt-empty">Os eventos aparecem aqui depois da primeira execução. Fonte: diagnóstico desta sessão.</p>
                  )}
                </section>

                <section className="idt-card">
                  <h3>Métricas desta sessão</h3>
                  <div className="idt-metrics">
                    <div>
                      <small>Execuções</small>
                      <b>{metrics.executions}</b>
                    </div>
                    <div>
                      <small>Taxa de sucesso</small>
                      <b>{metrics.executions ? `${Math.round((metrics.successes / metrics.executions) * 100)}%` : "—"}</b>
                    </div>
                    <div>
                      <small>Última duração</small>
                      <b>{lastResult?.durationMs !== undefined ? formatDuration(lastResult.durationMs) : exec?.spanMs !== undefined ? formatDuration(exec.spanMs) : "—"}</b>
                    </div>
                  </div>
                  <p className="idt-fine">
                    <Clock3 size={12} aria-hidden="true" /> Diagnóstico mantido em memória enquanto a sessão local estiver aberta.
                  </p>
                </section>

                <section className="idt-card">
                  <h3>Status dos componentes</h3>
                  <ul className="idt-status">
                    {graph.nodes.map((n) => (
                      <li key={n.id}>
                        <button type="button" onClick={() => {
                          setSelected(n.id);
                          setSideTab("no");
                        }}>
                          <i className={`is-${n.state}`} aria-hidden="true" />
                          <span>
                            <strong>{n.title}</strong>
                            <small>{n.stateLabel}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <section className="idt-card idt-explain">
                <h3>Como funciona esta conexão</h3>
                <ConnectionExplainer profile={profile} origin={window.location.origin} />
              </section>
            </div>
            <aside className="idt-side">
              <div className="idt-side-head">
                <Ring done={life.done} total={life.total} size={52} />
                <span>
                  <strong>{profile.name}</strong>
                  <small>
                    {providerLabel(profile)} · {server.title}
                  </small>
                </span>
              </div>
              <div className="idt-seg" role="group" aria-label="Painel lateral">
                <button type="button" aria-pressed={sideTab === "geral"} onClick={() => setSideTab("geral")}>
                  Visão geral
                </button>
                <button type="button" aria-pressed={sideTab === "no"} onClick={() => setSideTab("no")}>
                  Componente
                </button>
              </div>
              {sideTab === "geral" ? (
                <>
                  <ol className="idt-stages">
                    {life.stages.map((s) => (
                      <li key={s.id} className={s.done ? "is-done" : life.next?.id === s.id ? "is-next" : ""}>
                        {s.done ? <CheckCircle2 size={15} aria-hidden="true" /> : <span className="idt-stage-dot" aria-hidden="true" />}
                        <span>
                          <strong>{s.label}</strong>
                          {!s.done && <small>{s.hint}</small>}
                        </span>
                        {!s.done && life.next?.id === s.id && (
                          <button type="button" className="lx-btn lx-btn--sm" onClick={() => (s.tab === "credenciais" ? (profile.authMode === "bearer" ? onTab("configuracao") : onConnectIdentity(profile)) : onTab(s.tab as IntegrationTab))}>
                            Fazer
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                  <dl className="idt-facts">
                    <div>
                      <dt>Protocolo</dt>
                      <dd>{profile.transport === "stdio" ? "MCP via STDIO" : "MCP via HTTPS"}</dd>
                    </div>
                    <div>
                      <dt>Cliente MCP</dt>
                      <dd>{server.title}</dd>
                    </div>
                    <div>
                      <dt>Ferramenta principal</dt>
                      <dd>{mainTool}</dd>
                    </div>
                    <div>
                      <dt>Autenticação</dt>
                      <dd>
                        {authLabel[profile.authMode] || profile.authMode}
                        {accessName ? ` · ${accessName}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>Recurso consultado</dt>
                      <dd>
                        {target.title}
                        <small>{target.subtitle}</small>
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <div className="idt-node">
                  <h3>{node.title}</h3>
                  <span className={`idt-pill is-${node.state}`}>
                    <i aria-hidden="true" /> {node.stateLabel}
                  </span>
                  <p>{node.detail}</p>
                  {nodeAction(node) && (
                    <button type="button" className="lx-btn" onClick={nodeAction(node)!.onClick}>
                      {nodeAction(node)!.label}
                    </button>
                  )}
                </div>
              )}
              <div className="idt-links">
                <h4>Links úteis</h4>
                {docLinks(profile).map(([label, href]) => (
                  <a key={href} href={href} target="_blank" rel="noreferrer">
                    <BookOpen size={14} aria-hidden="true" /> {label} <ExternalLink size={13} aria-hidden="true" />
                  </a>
                ))}
              </div>
            </aside>
          </div>
        </>
      )}

      {tab === "testar" && (
        <ToolTester
          key={profile.id}
          profile={profile}
          profiles={profiles}
          tools={tools}
          setTools={setTools}
          running={running}
          setRunning={setRunning}
          onResult={recordResult}
          lastDisplay={lastDisplay}
          onChanged={onRefresh}
          identityReady={idReady}
          onFixIdentity={() => (profile.authMode === "bearer" ? onTab("configuracao") : onConnectIdentity(profile))}
        />
      )}

      {tab === "configuracao" && (
        <IntegrationForm
          key={`${profile.id}:${profile.configurationVersion}`}
          initial={profile}
          accesses={accesses}
          azureAuthenticated={azureAuthenticated}
          activeAccessId={activeAccessId}
          principalKind={principalKind}
          onSaved={() => onRefresh()}
          onDeleted={onDeleted}
          onOpenAccesses={onOpenAccesses}
        />
      )}
      {tab === "configuracao" && <CopilotExport profile={profile} />}

      {tab === "atividade" && (
        <section className="idt-activity">
          <header>
            <h2>Atividade desta integração</h2>
            <button type="button" className="lx-btn" disabled={refreshing} onClick={onRefresh}>
              <RefreshCw size={14} aria-hidden="true" /> {refreshing ? "Atualizando…" : "Atualizar"}
            </button>
          </header>
          <p className="idt-fine">Eventos registrados pelo serviço local nesta sessão. Argumentos e credenciais não são gravados.</p>
          {connectionEvents(events, profile).length === 0 ? (
            <p className="idt-empty">Sem eventos para esta integração.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Horário</th>
                    <th>Origem</th>
                    <th>Operação</th>
                    <th>Status</th>
                    <th>Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {connectionEvents(events, profile).map((e, i) => (
                    <tr key={i}>
                      <td>{new Date(e.time).toLocaleTimeString("pt-BR")}</td>
                      <td>{e.source}</td>
                      <td>
                        <code>{e.operation}</code>
                      </td>
                      <td>
                        <span className={`idt-status-chip ${/^2|sucesso|conectado/.test(e.status) ? "is-ok" : /^[45]|fail|falh/.test(e.status) ? "is-error" : ""}`}>{e.status}</span>
                      </td>
                      <td>{e.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

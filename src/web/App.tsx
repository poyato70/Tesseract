import { CopilotSeats } from "./pages/CopilotSeats.js";
import { isOperationalFailure } from "./flow/operational.js";
import { TesseractLoader } from "./flow/TesseractLoader.js";
/**
 * Tesseract — shell reconstruído (missão 22).
 *
 * Ordem das funções: Início → Integrações (catálogo, minhas integrações,
 * credenciais e a página única de cada integração) → FinOps → Agentes e IA →
 * Operação. Integrar e testar acontecem na mesma página: /integracoes/:id.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CostQuery, DateRange, Scope, Subscription } from "../shared/contracts.js";
import type { PublicAccessProfile, PublicAgent } from "../shared/connections.js";
import type { DiagnosticEvent } from "../server/diagnostics/service.js";
import { api, manageRequest, selectDataSource, type Bootstrap } from "./api.js";
import { Sidebar } from "./shell/Sidebar.js";
import { Topbar } from "./shell/Topbar.js";
import { Overview } from "./shell/Overview.js";
import { formatPath, normalizePage, parsePath, routeSection, routeTitle, type IntegrationTab, type Route } from "./shell/routes.js";
import { IntegrationsList } from "./integrations/IntegrationsList.js";
import { IntegrationDetail } from "./integrations/IntegrationDetail.js";
import { IntegrationForm, draftFor } from "./integrations/IntegrationForm.js";
import { Catalog } from "./integrations/Catalog.js";
import { lifecycle, type IntegrationProfile } from "./integrations/model.js";
import { AdvisorQuickStart } from "./components/AdvisorQuickStart.js";
import { ScopeFilters } from "./components/ScopeFilters.js";
import { Knowledge } from "./pages/Knowledge.js";
import { Investigations } from "./pages/Investigations.js";
import { Help } from "./pages/Help.js";
import { TagCosts } from "./pages/TagCosts.js";
import { ApiLab } from "./pages/ApiLab.js";
import { Multicloud } from "./pages/Multicloud.js";
import { Forecast } from "./pages/Forecast.js";
import { DiagnosticPanel } from "./pages/Diagnostics.js";
import { Hubs } from "./pages/Hubs.js";
import { Costs } from "./pages/Costs.js";
import { Budgets } from "./pages/Budgets.js";
import { Benefits } from "./pages/Benefits.js";
import { Chat } from "./pages/Chat.js";
import { Accesses } from "./pages/Accesses.js";
import { Agents } from "./pages/Agents.js";
import { FinOpsCorrelation } from "./pages/FinOpsCorrelation.js";
import { GlobalObservability } from "./pages/GlobalObservability.js";

const LazyTesseractOpening = lazy(async () => {
  const module = await import("./pages/TesseractOpening.js");
  return { default: module.TesseractOpening };
});

/** Páginas que consultam a Azure diretamente e precisam de login e escopo. */
const azurePages = ["costs", "tag-costs", "forecast", "budgets", "benefits", "chat", "hubs", "api-lab", "finops-correlation"];
const inventoryPages = ["costs", "tag-costs", "forecast", "budgets", "benefits", "chat", "hubs", "api-lab"];

export function App() {
  const [route, setRoute] = useState<Route>(() => parsePath(window.location.pathname));
  const page = route.page;
  const [openingOpen, setOpeningOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const closeOpening = useCallback(() => setOpeningOpen(false), []);
  const [insight, setInsight] = useState<{ text: string; source: string; requestId: string }>();
  const [connectionFeedback, setConnectionFeedback] = useState<{ id: string; kind: "pending" | "success" | "error"; message: string }>();
  const [hubId, setHubId] = useState("");
  const [draft, setDraft] = useState<Record<string, any>>();
  const [recentId, setRecentId] = useState(() => (route.page === "integration" ? route.connectionId : ""));
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [diagnosticEvents, setDiagnosticEvents] = useState<DiagnosticEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [accesses, setAccesses] = useState<PublicAccessProfile[]>([]);
  const [mcpProfiles, setMcpProfiles] = useState<IntegrationProfile[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<PublicAgent[]>([]);
  const [chosenAccess, setChosenAccess] = useState("");
  const [accessMode, setAccessMode] = useState<"user" | "application">("user");
  const [source, setSource] = useState<"api" | "mcp">("api");
  const [mcpId, setMcpId] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const loginTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [boot, setBoot] = useState<Bootstrap>();
  const [error, setError] = useState("");
  const [info, setPageInfo] = useState<{ page: string; message: string }>();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [sub, setSub] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [group, setGroup] = useState("");
  const [period, setPeriod] = useState<DateRange>({ from: "", toExclusive: "", timeZone: "America/Sao_Paulo" });
  const [basis, setBasis] = useState<CostQuery["basis"]>("ActualCost");
  const [tenant, setTenant] = useState("");
  const [client, setClient] = useState("");
  const [groupBy, setGroupBy] = useState<CostQuery["groupBy"]>("ServiceName");
  const [granularity, setGranularity] = useState<CostQuery["granularity"]>("Daily");
  const setInfo = (message: string) => setPageInfo(message ? { page, message } : undefined);

  // Tema escuro estável (preferência do produto); as páginas legadas leem os tokens.
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);

  // ---------- navegação ----------
  const go = useCallback((next: Route) => {
    const path = formatPath(next);
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    setRoute(next);
    if (next.page === "integration") setRecentId(next.connectionId);
    window.scrollTo?.({ top: 0 });
  }, []);
  /** Aceita ids novos e os ids da missão 21 emitidos pelas páginas reaproveitadas. */
  const navigate = useCallback(
    (id: string, connectionId = "", tab: IntegrationTab = "visao") => {
      if (connectionId && ["mcps", "mcp-analysis", "discovery", "integration"].includes(id))
        return go({ page: "integration", connectionId, tab: id === "mcp-analysis" ? "testar" : tab });
      go({ page: normalizePage(id) });
    },
    [go],
  );
  const openIntegration = useCallback((id: string, tab: IntegrationTab = "visao") => go({ page: "integration", connectionId: id, tab }), [go]);
  useEffect(() => {
    const canonical = formatPath(route);
    if (canonical !== window.location.pathname) window.history.replaceState({}, "", canonical);
    const onPop = () => setRoute(parsePath(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => setPageInfo(undefined), [page]);
  useEffect(() => {
    document.title = `${route.page === "integration" ? mcpProfiles.find((p) => p.id === route.connectionId)?.name || "Integração" : routeTitle(route)} · TESSERACT`;
  }, [route, mcpProfiles]);

  // ---------- dados ----------
  const refreshDiagnostics = async () => {
    setActivityLoading(true);
    try {
      const events = await manageRequest<DiagnosticEvent[]>("/diagnostics");
      setDiagnosticEvents(Array.isArray(events) ? events : []);
    } catch {
      setDiagnosticEvents([]);
    } finally {
      setActivityLoading(false);
    }
  };
  const reloadSettings = async () => {
    try {
      const [a, m, g] = await Promise.all([manageRequest("/accesses"), manageRequest("/mcp-connections"), manageRequest("/agents")]);
      setAccesses(Array.isArray(a) ? a : []);
      setMcpProfiles(Array.isArray(m) ? m : []);
      setAgentProfiles(Array.isArray(g) ? g : []);
      setSettingsLoaded(true);
      void refreshDiagnostics();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    selectDataSource({ source, mcpConnectionId: mcpId || undefined });
  }, [source, mcpId]);
  useEffect(
    () => () => {
      if (loginTimer.current) clearInterval(loginTimer.current);
    },
    [],
  );
  useEffect(() => {
    let active = true;
    api
      .bootstrap()
      .then((b) => {
        if (!active) return;
        setBoot(b);
        if (b.activeAccessId) setChosenAccess(b.activeAccessId);
        void reloadSettings();
        setPeriod(b.period);
        setTenant(b.tenantId);
        setClient(b.clientId);
        if (b.loginError) setError(b.loginError.message);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  // Estados vivos: as telas de integração atualizam conexões e diagnóstico a cada 15 s.
  const livePage = ["home", "integrations", "integration"].includes(page);
  useEffect(() => {
    if (!livePage || !settingsLoaded) return;
    const controller = new AbortController();
    let checking = false;
    const tick = async () => {
      if (checking || document.hidden) return;
      checking = true;
      try {
        const [profiles, events] = await Promise.all([
          manageRequest("/mcp-connections", "GET", undefined, controller.signal),
          manageRequest("/diagnostics", "GET", undefined, controller.signal),
        ]);
        if (!controller.signal.aborted) {
          if (Array.isArray(profiles)) setMcpProfiles(profiles);
          if (Array.isArray(events)) setDiagnosticEvents(events);
        }
      } catch {
        /* mantém o último retrato até a próxima leitura */
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(() => void tick(), 15000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [livePage, settingsLoaded]);
  useEffect(() => setHubId(""), [boot?.activeAccessId, boot?.authenticated]);
  const needsInventory = inventoryPages.includes(page);
  useEffect(() => {
    if (!boot?.authenticated || !needsInventory) return;
    const c = new AbortController();
    api
      .subscriptions(c.signal)
      .then((s) => {
        setSubs(s);
        setSub((cur) => cur || s[0]?.id || "");
      })
      .catch((e) => !c.signal.aborted && setError(e.message));
    return () => c.abort();
  }, [boot?.authenticated, needsInventory]);
  useEffect(() => {
    setGroup("");
    setGroups([]);
    if (!sub) return;
    const c = new AbortController();
    api
      .groups(sub, c.signal)
      .then(setGroups)
      .catch((e) => !c.signal.aborted && setError(e.message));
    return () => c.abort();
  }, [sub]);
  const scope = useMemo<Scope | undefined>(
    () => (boot?.authenticated && sub ? { tenantId: boot.tenantId, subscriptionId: sub, ...(group ? { resourceGroup: group } : {}) } : undefined),
    [boot, sub, group],
  );
  const query = useMemo<CostQuery | undefined>(() => (scope ? { scope, period, basis, groupBy, granularity } : undefined), [scope, period, basis, groupBy, granularity]);
  const chatSelection = useMemo(
    () => (boot?.activeAccessId ? { hubId: hubId || undefined, accessId: boot.activeAccessId, source, mcpConnectionId: mcpId || undefined } : undefined),
    [boot?.activeAccessId, source, mcpId, hubId],
  );
  useEffect(() => setInsight(undefined), [scope, basis, source, mcpId, hubId, period, boot?.activeAccessId, boot?.authenticated]);

  // ---------- identidade ----------
  async function connectApplicationAccess(accessId: string) {
    const result = await manageRequest(`/accesses/${accessId}/connect`, "POST", { mode: "application" });
    const bootstrap = await api.bootstrap();
    setBoot(bootstrap);
    return { result, bootstrap };
  }
  function pollLogin(started: number, success: string, onDone?: () => void) {
    let checking = false;
    loginTimer.current = setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        const current = await api.bootstrap();
        if (current.authenticated || current.loginError) {
          clearInterval(loginTimer.current);
          loginTimer.current = undefined;
          setLoginPending(false);
          setBoot(current);
          setError(current.loginError?.message || "");
          setInfo(current.authenticated ? success : "A autorização não foi concluída. Veja a mensagem acima.");
          onDone?.();
        } else if (Date.now() - started > 600000) {
          clearInterval(loginTimer.current);
          loginTimer.current = undefined;
          setLoginPending(false);
          setError("A tentativa excedeu 10 minutos. Tenant e identidade não foram alterados; inicie uma nova tentativa se desejar.");
        }
      } catch (e) {
        clearInterval(loginTimer.current);
        loginTimer.current = undefined;
        setLoginPending(false);
        setError((e as Error).message);
      } finally {
        checking = false;
      }
    }, 1000);
  }
  async function connect(accessId?: string, mode: "user" | "application" = "user", inline = false) {
    if (accessId && mode === "application") {
      setError("");
      setInfo("");
      if (inline) setConnectionFeedback({ id: accessId, kind: "pending", message: "Conectando aplicação…" });
      try {
        const { result: r } = await connectApplicationAccess(accessId);
        const detail = r?.accessName ? `"${r.accessName}" (client ${r.clientId}, tenant ${r.tenantId}) — token ARM válido até ${new Date(r.expiresAt).toLocaleString("pt-BR")}.` : "";
        if (inline) setConnectionFeedback({ id: accessId, kind: "success", message: "Aplicação conectada com sucesso. " + detail });
        else setInfo("Credencial de aplicação ativada " + detail + " Nenhum login de usuário foi solicitado.");
        void reloadSettings();
      } catch (e) {
        if (inline) setConnectionFeedback({ id: accessId, kind: "error", message: (e as Error).message });
        else setError((e as Error).message);
      }
      return;
    }
    if (loginPending) return;
    setError("");
    const popup = window.open("about:blank", "azure-cost-login", "popup=yes,width=560,height=760");
    if (!popup) {
      setError("Permita pop-ups para localhost para abrir o login em uma janela separada.");
      return;
    }
    const note = popup.document.createElement("p");
    note.textContent = "Preparando o login Microsoft…";
    popup.document.body.append(note);
    setLoginPending(true);
    setInfo("Conclua o login na janela separada. A tela será atualizada automaticamente.");
    try {
      let login: { url: string };
      if (accessId) login = await manageRequest("/accesses/" + accessId + "/connect", "POST", { mode });
      else {
        await api.config(tenant.trim(), client.trim());
        setBoot(await api.bootstrap());
        login = await api.login();
      }
      popup.location.assign(login.url);
      popup.focus();
      pollLogin(Date.now(), "Login Microsoft concluído.", () => void reloadSettings());
    } catch (e) {
      popup.close();
      setLoginPending(false);
      setInfo("");
      setError((e as Error).message);
    }
  }
  async function openResourceLogin(id: string, kind = "mcp-connections") {
    if (loginPending) return;
    const popup = window.open("about:blank", "azure-cost-login", "popup=yes,width=560,height=760");
    if (!popup) {
      setError("Permita pop-ups para localhost.");
      return;
    }
    setLoginPending(true);
    setError("");
    setInfo("Aguardando autorização Microsoft na janela separada…");
    try {
      const r = await manageRequest("/" + kind + "/" + id + "/login", "POST", {});
      popup.location.assign(r.url);
      popup.focus();
      setInfo("Autorize o recurso na janela separada. Nenhuma conta ou tenant será trocado automaticamente.");
      pollLogin(Date.now(), "Recurso autorizado com a identidade de usuário selecionada.", () => void reloadSettings());
    } catch (e) {
      popup.close();
      setLoginPending(false);
      setInfo("");
      setError((e as Error).message);
    }
  }
  async function logout() {
    setInsight(undefined);
    try {
      await api.logout();
      setBoot(await api.bootstrap());
      setSub("");
      setSubs([]);
      setInfo("Sessão encerrada. Dados em memória foram limpos.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const identityActive = useCallback(
    (p: IntegrationProfile) =>
      !!p.accessId && boot?.activeAccessId === p.accessId && (p.authMode === "application" ? boot?.principalKind === "application" : boot?.principalKind === "user"),
    [boot?.activeAccessId, boot?.principalKind],
  );
  const connectIdentity = (p: IntegrationProfile) => {
    if (p.transport === "http" && p.authMode === "delegated") return void openResourceLogin(p.id);
    if (!p.accessId) return navigate("accesses");
    void connect(p.accessId, p.authMode === "application" ? "application" : "user");
  };

  const renderAdvisor = () => (
    <AdvisorQuickStart
      accesses={accesses}
      activeAccessId={boot?.principalKind === "application" ? boot.activeAccessId : undefined}
      initialConnection={undefined}
      onConnectAccess={async (id) => {
        const { bootstrap } = await connectApplicationAccess(id);
        if (!bootstrap.authenticated || bootstrap.principalKind !== "application" || bootstrap.activeAccessId !== id)
          throw new Error("O acesso escolhido não ficou ativo nesta sessão.");
      }}
      onPrepared={() => void reloadSettings()}
      onActivity={() => void reloadSettings()}
      onInspect={(id) => openIntegration(id, "testar")}
      onAccesses={() => navigate("accesses")}
    />
  );

  // ---------- derivados do shell ----------
  const activeAccess = accesses.find((a) => a.id === boot?.activeAccessId);
  const integration = route.page === "integration" ? mcpProfiles.find((p) => p.id === route.connectionId) : undefined;
  const recent = mcpProfiles.find((p) => p.id === recentId);
  const nextStep = useMemo(() => {
    const list = mcpProfiles.filter((p) => p.id !== "default");
    if (!settingsLoaded) return undefined;
    if (!list.length) return { title: "Primeira integração", detail: "Escolha um serviço no catálogo.", onClick: () => navigate("catalog") };
    for (const p of list) {
      const life = lifecycle(p, { identityActive: identityActive(p), events: diagnosticEvents });
      if (life.next)
        return {
          title: life.next.label,
          detail: p.name,
          onClick: () => (life.next!.tab === "credenciais" ? connectIdentity(p) : openIntegration(p.id, life.next!.tab as IntegrationTab)),
        };
    }
    return { title: "Tudo pronto", detail: "Consulte custos e recomendações.", onClick: () => navigate("costs") };
  }, [mcpProfiles, settingsLoaded, diagnosticEvents, identityActive]);

  const crumbs = [
    { label: "Tesseract", page: "home" },
    ...(page === "home"
      ? [{ label: "Centro operacional" }]
      : [
          { label: routeSection(route), page: route.page === "integration" ? "integrations" : undefined },
          { label: route.page === "integration" ? integration?.name || "Integração" : routeTitle(route) },
        ]),
  ];
  const showAzureGate = azurePages.includes(page);
  const recentFailures = diagnosticEvents.filter(
    (e) => Date.now() - Date.parse(e.time) < 15 * 60_000 && isOperationalFailure(e),
  ).length;

  return (
    <div className={`lx-app${pinned ? " is-pinned" : ""}`}>
      <div className="lx-backdrop" aria-hidden="true" />
      <Sidebar
        page={page}
        onSelect={(id) => navigate(id)}
        onPinnedChange={setPinned}
        session={{
          label: activeAccess?.name || (boot?.authenticated ? "Sessão Microsoft" : "Sessão local"),
          detail: boot?.authenticated ? (boot.principalKind === "application" ? "Identidade de aplicação ativa" : "Usuário conectado") : "Nenhuma credencial ativa",
          online: !!boot?.authenticated,
        }}
        nextStep={nextStep}
        recent={recent ? { id: recent.id, name: recent.name, active: route.page === "integration" && route.connectionId === recent.id, onClick: () => openIntegration(recent.id) } : undefined}
        onLogout={boot?.authenticated ? () => void logout() : undefined}
      />
      <main className="lx-main">
        <Topbar
          crumbs={crumbs}
          onCrumb={(id) => navigate(id)}
          integrations={mcpProfiles.filter((p) => p.id !== "default")}
          onNavigate={(id) => navigate(id)}
          onOpenIntegration={(id) => openIntegration(id)}
          alerts={recentFailures}
          session={{ label: boot?.authenticated ? `Azure · ${activeAccess?.name || "conectado"}` : "Azure · desconectado", online: !!boot?.authenticated }}
        />

        <div className="lx-content">
          {route.page !== "integration" && page !== "home" && (
            <div className="lx-page-head">
              <span className="ov-eyebrow">{routeSection(route).toUpperCase()}</span>
              <h1>{routeTitle(route)}</h1>
            </div>
          )}
          {error && (
            <div role="alert" className="lx-alert is-error">
              <span>{error}</span>
              <button type="button" onClick={() => setError("")}>
                Fechar
              </button>
            </div>
          )}
          {info?.page === page && <p className="lx-alert is-info">{info.message}</p>}
          {!boot && <p role="status">Iniciando serviço local…</p>}

          {boot && showAzureGate && !boot.authenticated && (
            <section className="lx-gate">
              <div>
                <span className="ov-eyebrow">CONECTE A AZURE</span>
                <h2>Esta análise consulta a Azure diretamente</h2>
                <p>Ative uma credencial salva ou entre pela página oficial da Microsoft (com MFA). A senha permanece com a Microsoft.</p>
                <button type="button" className="lx-btn" onClick={() => navigate("accesses")}>
                  Usar uma credencial salva →
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void connect();
                }}
              >
                <label>
                  Tenant ID
                  <input value={tenant} onChange={(e) => setTenant(e.target.value)} placeholder="Identificador do diretório" required pattern="[0-9a-fA-F-]{36}" />
                </label>
                <label>
                  Application (Client) ID
                  <input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Identificador do aplicativo público" required pattern="[0-9a-fA-F-]{36}" />
                </label>
                <button className="lx-btn lx-btn--primary" type="submit" disabled={loginPending}>
                  {loginPending ? <><TesseractLoader size={18} /> Aguardando login…</> : "Entrar com Microsoft ↗"}
                </button>
                <small>Callback: {window.location.origin}/api/auth/callback · aplicativo público, sem Client Secret</small>
              </form>
            </section>
          )}

          {boot && showAzureGate && accesses.length > 0 && (
            <section className="lx-toolbar">
              <label>
                Credencial
                <select
                  value={chosenAccess}
                  onChange={(e) => {
                    setChosenAccess(e.target.value);
                    const a = accesses.find((x) => x.id === e.target.value);
                    if (a) setAccessMode(a.preferredMode);
                  }}
                >
                  <option value="">Selecione</option>
                  {accesses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Modo
                <select value={accessMode} onChange={(e) => setAccessMode(e.target.value as any)}>
                  <option value="user">Usuário</option>
                  <option value="application">Aplicação</option>
                </select>
              </label>
              <button type="button" className="lx-btn" disabled={!chosenAccess || loginPending} onClick={() => void connect(chosenAccess, accessMode)}>
                Ativar credencial
              </button>
              <label>
                Fonte dos dados
                <select value={source} onChange={(e) => setSource(e.target.value as any)}>
                  <option value="api">APIs Azure</option>
                  <option value="mcp">Integração MCP</option>
                </select>
              </label>
              {source === "mcp" && (
                <label>
                  Integração
                  <select value={mcpId} onChange={(e) => setMcpId(e.target.value)}>
                    <option value="">Selecione</option>
                    {mcpProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </section>
          )}
          {source === "mcp" && ["costs", "forecast", "budgets", "benefits", "chat"].includes(page) && (
            <section className="lx-alert is-info" role="status">
              <span>
                {page === "chat"
                  ? "No chat, a integração MCP oferece somente as tools descobertas e aprovadas. pricing_get consulta preços de catálogo, não o gasto do RG."
                  : "Esta análise usa as APIs Azure nesta versão. A integração MCP selecionada não alimenta este cartão; teste-a na página da integração."}
              </span>
              <button type="button" onClick={() => setSource("api")}>
                Usar APIs Azure
              </button>
              {mcpId && (
                <button type="button" onClick={() => openIntegration(mcpId, "testar")}>
                  Testar integração
                </button>
              )}
            </section>
          )}
          {boot && showAzureGate && (
            <ScopeFilters
              subscriptions={subs}
              subscription={sub}
              setSubscription={setSub}
              groups={groups}
              group={group}
              setGroup={setGroup}
              period={period}
              setPeriod={setPeriod}
              basis={basis}
              setBasis={setBasis}
              disabled={!boot?.authenticated || (source === "mcp" && ["costs", "forecast", "budgets", "benefits"].includes(page))}
            />
          )}

          {page === "home" && (
            <Overview
              profiles={mcpProfiles}
              accesses={accesses}
              events={diagnosticEvents}
              loaded={settingsLoaded}
              activeAccessId={boot?.activeAccessId}
              principalKind={boot?.principalKind}
              authenticated={!!boot?.authenticated}
              onNavigate={(id) => navigate(id)}
              onOpen={openIntegration}
              onRefresh={() => void reloadSettings()}
              onActivateAccess={(id) => {
                const a = accesses.find((x) => x.id === id);
                void connect(id, a?.preferredMode === "application" ? "application" : "user");
              }}
            />
          )}

          {page === "integrations" && (
            <IntegrationsList
              profiles={mcpProfiles}
              loaded={settingsLoaded}
              events={diagnosticEvents}
              identityActive={identityActive}
              onOpen={openIntegration}
              onCatalog={() => navigate("catalog")}
              onAccesses={() => navigate("accesses")}
            />
          )}

          {page === "catalog" && (
            <Catalog
              onConfigure={(d) => {
                setDraft(d);
                navigate("integration-new");
              }}
              onNavigate={(id) => navigate(id === "azure-ai" ? "catalog" : id)}
              advisorGuide={renderAdvisor}
            />
          )}

          {page === "integration-new" && (
            <section className="lx-panel">
              <IntegrationForm
                key={JSON.stringify(draft || {})}
                initial={draft || draftFor("azure")}
                accesses={accesses}
                azureAuthenticated={!!boot?.authenticated}
                activeAccessId={boot?.activeAccessId}
                principalKind={boot?.principalKind}
                onSaved={(saved) => {
                  setDraft(undefined);
                  void reloadSettings();
                  if (saved?.id) openIntegration(saved.id);
                }}
                onCancel={() => navigate("catalog")}
                onOpenAccesses={() => navigate("accesses")}
              />
            </section>
          )}

          {route.page === "integration" &&
            (integration ? (
              <IntegrationDetail
                key={integration.id}
                profile={integration}
                profiles={mcpProfiles}
                tab={route.tab || "visao"}
                onTab={(tab) => openIntegration(integration.id, tab)}
                accesses={accesses}
                events={diagnosticEvents}
                activeAccessId={boot?.activeAccessId}
                principalKind={boot?.principalKind}
                azureAuthenticated={!!boot?.authenticated}
                identityActive={identityActive(integration)}
                onRefresh={() => void reloadSettings()}
                refreshing={activityLoading}
                onConnectIdentity={connectIdentity}
                onOpenAccesses={() => navigate("accesses")}
                onDeleted={() => {
                  void reloadSettings();
                  navigate("integrations");
                }}
              />
            ) : settingsLoaded ? (
              <section className="il-empty" role="status">
                <h2>Integração não encontrada</h2>
                <p>Ela pode ter sido excluída ou pertencer a outro perfil local.</p>
                <button type="button" className="lx-btn lx-btn--primary" onClick={() => navigate("integrations")}>
                  Voltar às integrações
                </button>
              </section>
            ) : (
              <div className="lx-loading"><TesseractLoader size={40} label="Carregando integração…" /></div>
            ))}

          {page === "accesses" && (
            <section className="lx-panel">
              <Accesses profiles={accesses} loginPending={loginPending} onChanged={() => void reloadSettings()} connectionFeedback={connectionFeedback} onConnect={(id, mode) => void connect(id, mode, true)} />
            </section>
          )}

          {page === "copilot-seats" && <CopilotSeats profiles={mcpProfiles as any} onOpenCatalog={() => navigate("catalog")} />}

          {page === "multicloud" && (
            <section className="lx-panel">
              <Multicloud scope={scope} period={period} onAzure={() => navigate("costs")} />
            </section>
          )}

          {page === "costs" && (
            <section className="lx-panel">
              <div className="lx-inline-tools">
                <label>
                  Detalhar por
                  <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as CostQuery["groupBy"])}>
                    <option value="ServiceName">Serviço</option>
                    <option value="ResourceId">Recurso</option>
                  </select>
                </label>
                <label>
                  Série
                  <select value={granularity} onChange={(e) => setGranularity(e.target.value as CostQuery["granularity"])}>
                    <option value="Daily">Diária</option>
                    <option value="Monthly">Mensal</option>
                  </select>
                </label>
                <button type="button" className="lx-btn" onClick={() => boot && setPeriod(boot.period)}>
                  Dois meses completos
                </button>
                <button
                  type="button"
                  className="lx-btn"
                  onClick={() => {
                    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
                    const to = new Date(today + "T00:00:00Z");
                    to.setUTCDate(to.getUTCDate() + 1);
                    const from = new Date(to);
                    from.setUTCDate(from.getUTCDate() - 60);
                    setPeriod({ from: from.toISOString().slice(0, 10), toExclusive: to.toISOString().slice(0, 10), timeZone: "America/Sao_Paulo" });
                  }}
                >
                  Últimos 60 dias
                </button>
                {insight && (
                  <span className="lx-chip is-ok" title={insight.source}>
                    Insight do chat disponível
                  </span>
                )}
              </div>
              <Costs key={boot?.activeAccessId + "|" + source + "|" + mcpId} query={query} connected={!!boot?.authenticated && source === "api"} />
            </section>
          )}
          {page === "tag-costs" && <section className="lx-panel">{source === "api" ? <TagCosts query={query} /> : <p>Escolha APIs Azure para consultar tags históricas da cobrança.</p>}</section>}
          {page === "forecast" && (
            <section className="lx-panel">
              <fieldset className="channel-guard" disabled={source === "mcp"}>
                <Forecast
                  key={boot?.activeAccessId + "|" + source}
                  scope={scope}
                  period={period}
                  basis={basis}
                  onMonth={() => {
                    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
                    const y = Number(parts.find((p) => p.type === "year")!.value);
                    const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
                    setPeriod({ from: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10), toExclusive: new Date(Date.UTC(y, m + 1, 1)).toISOString().slice(0, 10), timeZone: "America/Sao_Paulo" });
                  }}
                />
              </fieldset>
            </section>
          )}
          {page === "budgets" && (
            <section className="lx-panel">
              <fieldset className="channel-guard" disabled={source === "mcp"}>
                <Budgets key={boot?.activeAccessId + "|" + source + "|" + mcpId} scope={scope} />
              </fieldset>
            </section>
          )}
          {page === "benefits" && (
            <section className="lx-panel">
              <fieldset className="channel-guard" disabled={source === "mcp"}>
                <Benefits key={boot?.activeAccessId + "|" + source + "|" + mcpId} scope={scope} />
              </fieldset>
            </section>
          )}
          {page === "hubs" && (
            <section className="lx-panel">
              <Hubs
                key={boot?.activeAccessId}
                accesses={accesses}
                mcps={mcpProfiles as any}
                scope={scope}
                basis={basis}
                selected={hubId}
                onSelect={setHubId}
                loginPending={loginPending}
                onLogin={(id) => void openResourceLogin(id, "hubs")}
              />
            </section>
          )}
          {page === "finops-correlation" && (
            <section className="lx-panel">
              <FinOpsCorrelation profiles={mcpProfiles as any} />
            </section>
          )}
          {page === "api-lab" && (
            <section className="lx-panel">
              {source === "api" ? (
                <ApiLab query={query} setGroupBy={setGroupBy} setGranularity={setGranularity} subscriptionLabel={subs.find((s) => s.id === sub)?.name || ""} />
              ) : (
                <p>Escolha APIs Azure antes de testar nesta página.</p>
              )}
            </section>
          )}
          {["agents", "agent-lab"].includes(page) && (
            <section className="lx-panel">
              {page === "agent-lab" && (
                <p className="idt-fine">
                  Use “Testar modelo” nos cartões. Saúde do endpoint HTTP não comprova acesso financeiro; confira runtime, credencial e tools autorizadas, e acompanhe a execução no Chat e em
                  Atividade.
                </p>
              )}
              <Agents
                evaluationOnly={page === "agent-lab"}
                onOpenChat={() => navigate("chat")}
                profiles={agentProfiles}
                accesses={accesses}
                mcps={mcpProfiles as any}
                onChanged={() => void reloadSettings()}
              />
            </section>
          )}
          {page === "knowledge" && (
            <section className="lx-panel">
              <Knowledge />
            </section>
          )}
          {page === "investigations" && (
            <section className="lx-panel">
              <Investigations mcps={mcpProfiles as any} agents={agentProfiles} onAzure={() => navigate("chat")} />
            </section>
          )}
          {page === "chat" && (
            <section className="lx-panel">
              <Chat
                onInsight={setInsight}
                key={boot?.activeAccessId + "|" + source + "|" + mcpId + "|" + hubId}
                scope={scope}
                basis={basis}
                selectedSource={source}
                connectionLabel={mcpProfiles.find((p) => p.id === mcpId)?.name}
                agents={agentProfiles}
                selection={chatSelection}
              />
            </section>
          )}
          {page === "diagnostics" && (
            <section className="lx-panel">
              <DiagnosticPanel />
            </section>
          )}
          {page === "new_features_ux" && (
            <section className="lx-panel">
              <GlobalObservability />
            </section>
          )}
          {page === "help" && (
            <section className="lx-panel">
              <Help />
            </section>
          )}

          <footer className="lx-footer">
            <span>TESSERACT · FinOps e IA, decisões informadas.</span>
            <button type="button" className="if-link" onClick={() => setOpeningOpen(true)}>
              Viemos em paz
            </button>
            <span>America/Sao_Paulo · valores na moeda de origem</span>
          </footer>
        </div>
      </main>
      {openingOpen && (
        <Suspense fallback={<div className="opening-loading" role="status">Preparando animação…</div>}>
          <LazyTesseractOpening onClose={closeOpening} />
        </Suspense>
      )}
    </div>
  );
}


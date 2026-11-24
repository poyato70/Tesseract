import { TesseractLoader } from "../flow/TesseractLoader.js";
import { useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, CircleDashed, Play, PlugZap, Search, ShieldCheck, Unplug } from "lucide-react";
import { manageRequest } from "../api.js";
import { SchemaInputs, schemaDefaults, resolveSchema } from "../components/SchemaInputs.js";
import { McpToolResult } from "../components/McpToolResult.js";
import { applyPricingDefaults } from "../components/pricing-defaults.js";
import { McpLab } from "../pages/McpLab.js";
import { advisorListArguments } from "../../shared/advisor-quick-start.js";
import { isAdvisorProfile, resultCount, type IntegrationProfile, type LastResult, type ListedTool } from "./model.js";

export function defaultArguments(profile: IntegrationProfile, tool?: ListedTool) {
  if (!tool) return {};
  if (isAdvisorProfile(profile)) {
    const args = advisorListArguments(tool as any, profile.resourceContext?.subscription || "");
    if (args) return args as Record<string, unknown>;
  }
  return applyPricingDefaults(tool.name, tool.inputSchema, schemaDefaults(tool.inputSchema) || {}, true);
}

/** Executa uma tool e devolve o resultado no formato usado pelo mapa e pelo renderizador. */
export async function runTool(profile: IntegrationProfile, tool: ListedTool, args: Record<string, unknown>, confirmed: boolean) {
  const started = Date.now();
  const response = await manageRequest(`/mcp-connections/${profile.id}/call`, "POST", {
    name: tool.name,
    arguments: args,
    ...(tool.schemaHash ? { expectedSchemaHash: tool.schemaHash } : {}),
    confirmedExecution: confirmed,
  });
  const durationMs = typeof response?.durationMs === "number" ? response.durationMs : Date.now() - started;
  return {
    display: {
      tool: tool.name,
      connection: profile.name,
      at: new Date().toLocaleString("pt-BR"),
      durationMs,
      requestedLanguage: typeof args.language === "string" ? args.language : undefined,
      response,
    },
    summary: {
      ok: true,
      at: new Date().toISOString(),
      tool: tool.name,
      durationMs,
      count: resultCount(response),
    } satisfies LastResult,
  };
}

export function ToolTester({
  profile,
  profiles,
  tools,
  setTools,
  running,
  setRunning,
  onResult,
  lastDisplay,
  onChanged,
  identityReady,
  onFixIdentity,
}: {
  profile: IntegrationProfile;
  profiles: IntegrationProfile[];
  tools: ListedTool[] | undefined;
  setTools: (tools: ListedTool[] | undefined) => void;
  running: boolean;
  setRunning: (v: boolean) => void;
  onResult: (summary: LastResult, display?: any) => void;
  lastDisplay?: any;
  onChanged: () => void;
  identityReady: boolean;
  onFixIdentity: () => void;
}) {
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error" | "info"; text: string }>();
  const [chosen, setChosen] = useState<string[]>(() => (tools || []).filter((t) => t.approved).map((t) => t.name));
  const [search, setSearch] = useState("");
  const [toolName, setToolName] = useState("");
  const [args, setArgs] = useState<Record<string, unknown>>({});
  const [json, setJson] = useState("{}");
  const [advanced, setAdvanced] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [execError, setExecError] = useState("");

  const approved = (tools || []).filter((t) => t.approved);
  const dirty = (tools || []).some((t) => chosen.includes(t.name) !== !!t.approved);
  const selected = approved.find((t) => t.name === toolName);
  const eachCall = selected?._meta?.["tesseract/approval"] === "each-call";
  const filtered = useMemo(
    () => (tools || []).filter((t) => `${t.name} ${t.description || ""}`.toLowerCase().includes(search.toLowerCase())),
    [tools, search],
  );

  async function connect() {
    setBusy("connect");
    setNotice(undefined);
    try {
      const r = await manageRequest(`/mcp-connections/${profile.id}/test`, "POST", {});
      const list: ListedTool[] = Array.isArray(r?.tools) ? r.tools : [];
      setTools(list);
      setChosen(list.filter((t) => t.approved).map((t) => t.name));
      setNotice({ kind: "ok", text: `O servidor respondeu ao protocolo MCP e anunciou ${list.length} tool(s). Isso não comprova acesso aos dados: aprove uma leitura e execute.` });
      onChanged();
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
      onChanged();
    } finally {
      setBusy("");
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      await manageRequest(`/mcp-connections/${profile.id}/disconnect`, "POST", {});
      setTools(undefined);
      setNotice({ kind: "info", text: "Conexão encerrada. O cadastro e as aprovações continuam salvos." });
      onChanged();
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  }

  async function saveApprovals() {
    setBusy("approve");
    setNotice(undefined);
    try {
      await manageRequest(`/mcp-connections/${profile.id}/approve-tools`, "POST", { names: chosen });
      setTools((tools || []).map((t) => ({ ...t, approved: chosen.includes(t.name) })));
      setNotice({ kind: "ok", text: `${chosen.length} tool(s) aprovada(s). Escolha uma abaixo para executar.` });
      if (!chosen.includes(toolName)) setToolName("");
      onChanged();
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy("");
    }
  }

  function choose(name: string) {
    setToolName(name);
    setConfirmed(false);
    setExecError("");
    const t = approved.find((x) => x.name === name);
    const value = defaultArguments(profile, t);
    setArgs(value);
    setJson(JSON.stringify(value, null, 2));
    setAdvanced(false);
  }

  async function execute(ev: FormEvent) {
    ev.preventDefault();
    if (!selected) return;
    if (eachCall && !confirmed) {
      setExecError("Confirme esta execução. A confirmação é pedida a cada chamada.");
      return;
    }
    let data = args;
    if (advanced) {
      try {
        data = JSON.parse(json);
      } catch {
        setExecError("O JSON avançado não é válido.");
        return;
      }
    }
    data = isAdvisorProfile(profile) ? data : applyPricingDefaults(selected.name, selected.inputSchema, data);
    setExecError("");
    setRunning(true);
    try {
      const { display, summary } = await runTool(profile, selected, data, eachCall && confirmed);
      onResult(summary, display);
    } catch (e) {
      const message = (e as Error).message;
      setExecError(message + " Veja a aba Atividade para a etapa que falhou.");
      onResult({ ok: false, at: new Date().toISOString(), tool: selected.name, message });
    } finally {
      setRunning(false);
      if (eachCall) setConfirmed(false);
      onChanged();
    }
  }

  const step = (n: number, done: boolean, title: string, sub: string) => (
    <header className="tt-step-head">
      <span className={`tt-step-n${done ? " is-done" : ""}`}>{done ? <CheckCircle2 size={16} /> : n}</span>
      <span>
        <strong>{title}</strong>
        <small>{sub}</small>
      </span>
    </header>
  );

  return (
    <div className="tt">
      {!identityReady && (
        <div className="tt-callout" role="status">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            A credencial desta integração não está ativa nesta sessão. A conexão pode falhar até ela ser ativada.
          </span>
          <button type="button" onClick={onFixIdentity}>
            Resolver
          </button>
        </div>
      )}

      <section className="tt-step">
        {step(1, !!profile.connected && !!tools, "Conectar e listar tools", "Inicia o servidor (STDIO) ou abre a sessão HTTP e pede a lista de tools.")}
        <div className="tt-actions">
          <button type="button" className="lx-btn lx-btn--primary" disabled={!!busy} onClick={() => void connect()}>
            {busy === "connect" ? <TesseractLoader size={16} /> : <PlugZap size={15} aria-hidden="true" />} {busy === "connect" ? "Conectando…" : tools ? "Listar novamente" : "Conectar e listar tools"}
          </button>
          {profile.connected && (
            <button type="button" className="lx-btn" disabled={!!busy} onClick={() => void disconnect()}>
              <Unplug size={15} aria-hidden="true" /> Desconectar
            </button>
          )}
        </div>
        {profile.transport === "stdio" && !tools && (
          <p className="tt-fine">A primeira conexão STDIO pode baixar a versão oficial fixada do pacote (Azure 3.0.0 / Fabric 1.7.0).</p>
        )}
      </section>

      <section className="tt-step" aria-disabled={!tools}>
        {step(2, approved.length > 0, "Aprovar leituras", "Só tools classificadas como leitura podem ser aprovadas. A aprovação fica presa ao hash do schema.")}
        {!tools ? (
          <p className="tt-fine">Conecte para ver as tools anunciadas por este servidor.</p>
        ) : tools.length === 0 ? (
          <p className="tt-fine">O servidor não anunciou tools nesta consulta.</p>
        ) : (
          <>
            <label className="tt-search">
              <Search size={14} aria-hidden="true" />
              <input aria-label="Filtrar tools" placeholder="Filtrar por nome ou descrição…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <ul className="tt-tools">
              {filtered.map((t) => (
                <li key={t.name} className={!t.reviewable ? "is-blocked" : chosen.includes(t.name) ? "is-chosen" : ""}>
                  <label>
                    <input
                      type="checkbox"
                      disabled={!t.reviewable}
                      checked={chosen.includes(t.name)}
                      onChange={(e) => setChosen((x) => (e.target.checked ? [...x, t.name] : x.filter((n) => n !== t.name)))}
                    />
                    <span>
                      <strong>{t.name}</strong>
                      <small>{t.reviewable ? t.description?.slice(0, 180) || "Leitura disponível para aprovação." : "Bloqueada pela política de leitura desta conexão."}</small>
                    </span>
                    {t.approved ? <CheckCircle2 size={16} className="tt-ok" aria-label="Aprovada" /> : <CircleDashed size={16} className="tt-muted" aria-label="Não aprovada" />}
                  </label>
                </li>
              ))}
            </ul>
            {filtered.length === 0 && <p role="status">Nenhuma tool corresponde ao filtro.</p>}
            <div className="tt-actions">
              <button type="button" className={`lx-btn${dirty ? " lx-btn--primary" : ""}`} disabled={!dirty || !!busy} onClick={() => void saveApprovals()}>
                {busy === "approve" ? "Salvando…" : "Salvar aprovações"}
              </button>
              {dirty && <span className="tt-fine">Há alterações não salvas.</span>}
            </div>
          </>
        )}
      </section>

      {notice && (
        <p className={`tt-notice is-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      <section className="tt-step">
        {step(3, !!lastDisplay, "Executar uma consulta", "Escolha uma tool aprovada, preencha os parâmetros e execute. O resultado também anima o mapa vivo.")}
        <form className="tt-run" onSubmit={(e) => void execute(e)}>
          <label>
            Tool aprovada
            <select aria-label="Tool aprovada" value={toolName} onChange={(e) => choose(e.target.value)} disabled={!approved.length}>
              <option value="">{approved.length ? "Selecione" : "Nenhuma tool aprovada"}</option>
              {approved.map((t) => (
                <option key={t.name}>{t.name}</option>
              ))}
            </select>
          </label>
          {selected && (
            <>
              {!advanced && resolveSchema(selected.inputSchema, selected.inputSchema)?.properties && (
                <div className="tt-schema">
                  <SchemaInputs key={selected.name} schema={selected.inputSchema} value={args} onChange={(v) => {
                    setArgs(v);
                    setJson(JSON.stringify(v, null, 2));
                  }} />
                </div>
              )}
              <label className="tt-check">
                <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} /> Editar argumentos em JSON
              </label>
              {advanced && (
                <label>
                  Argumentos (JSON)
                  <textarea rows={7} value={json} onChange={(e) => setJson(e.target.value)} />
                </label>
              )}
              {eachCall && (
                <label className="tt-check">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Confirmo esta execução (pedido a cada chamada)
                </label>
              )}
            </>
          )}
          <div className="tt-actions">
            <button className="lx-btn lx-btn--primary" type="submit" disabled={!selected || running}>
              {running ? <TesseractLoader size={16} /> : <Play size={15} aria-hidden="true" />} {running ? "Executando…" : "Executar"}
            </button>
          </div>
          {execError && (
            <p className="tt-notice is-error" role="alert">
              {execError}
            </p>
          )}
        </form>
        {lastDisplay && (
          <div className="tt-result">
            <McpToolResult result={lastDisplay} />
          </div>
        )}
      </section>

      <details className="tt-advanced">
        <summary>Capacidades avançadas · prompts, resources e exportação</summary>
        <McpLab
          profiles={profiles}
          id={profile.id}
          setId={() => undefined}
          externalBusy={!!busy || running}
          onBusy={() => undefined}
          onTools={(items) => {
            setTools(items);
            setChosen(items.filter((t: any) => t.approved).map((t: any) => t.name));
          }}
          compact
          reviewedTools={tools || []}
        />
      </details>
    </div>
  );
}

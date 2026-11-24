import { useState } from "react";
import { ExternalLink, Save, Trash2 } from "lucide-react";
import { azureNamespaces, nativePreset, nativePresets } from "../../shared/mcp-catalog.js";
import { manageRequest } from "../api.js";
import { ArmScopePicker } from "../components/ArmScopePicker.js";
import { McpDetails } from "../components/McpDetails.js";
import type { PublicAccessProfile } from "../../shared/connections.js";
import { independentPresets, type IntegrationProfile } from "./model.js";

/** Padrões por serviço; idênticos aos validados na missão 21. */
export const presetDefaults: Record<string, { endpoint: string; transport: string; label: string }> = {
  azure: { endpoint: "", transport: "stdio", label: "Azure MCP (oficial)" },
  arm: { endpoint: "https://mcp.management.azure.com", transport: "http", label: "Azure Resource Manager MCP" },
  adx: { endpoint: "", transport: "stdio", label: "Azure Data Explorer" },
  foundry: { endpoint: "https://mcp.ai.azure.com", transport: "http", label: "Microsoft Foundry" },
  fabric: { endpoint: "https://api.fabric.microsoft.com/v1/mcp/core", transport: "http", label: "Microsoft Fabric" },
  powerbi: { endpoint: "https://api.fabric.microsoft.com/v1/mcp/powerbi", transport: "http", label: "Power BI" },
  ...Object.fromEntries(nativePresets.map((n) => [n.id, { endpoint: n.endpoint || "", transport: n.transport, label: n.label }])),
};

const groups: [string, string[]][] = [
  ["Microsoft Azure e Fabric", ["azure", "arm", "adx", "foundry", "fabric", "powerbi"]],
  ["Nuvem pública", nativePresets.filter((n) => n.group === "publica").map((n) => n.id)],
  ["GitHub corporativo", nativePresets.filter((n) => n.group === "github").map((n) => n.id)],
  ["Nuvem privada", nativePresets.filter((n) => n.group === "privada").map((n) => n.id)],
  ["Conhecimento", nativePresets.filter((n) => n.group === "conhecimento").map((n) => n.id)],
  ["Outros servidores", nativePresets.filter((n) => ["dados", "colaboracao"].includes(n.group)).map((n) => n.id)],
];

const contextFor: Record<string, Record<string, string>> = {
  arm: { scope: "" },
  adx: { clusterUri: "", database: "" },
  powerbi: { modelId: "" },
  fabric: { workspaceId: "" },
  azure: { namespace: "pricing" },
};

export function draftFor(preset: string, extra: Record<string, any> = {}) {
  const d = presetDefaults[preset] || presetDefaults.custom;
  return {
    name: "",
    preset,
    transport: d.transport,
    endpoint: d.endpoint,
    audience: "",
    accessId: "",
    authMode: independentPresets.includes(preset)
      ? nativePreset(preset)?.defaultAuth || nativePreset(preset)?.auth[0] || "none"
      : d.transport === "stdio" ? "application" : "delegated",
    resourceContext: { ...(contextFor[preset] || {}) },
    allowPrivateNetwork: false,
    ...extra,
  };
}

export function IntegrationForm({
  initial,
  accesses,
  azureAuthenticated,
  activeAccessId,
  principalKind,
  onSaved,
  onCancel,
  onDeleted,
  onOpenAccesses,
}: {
  initial: Partial<IntegrationProfile> & Record<string, any>;
  accesses: PublicAccessProfile[];
  azureAuthenticated: boolean;
  activeAccessId?: string;
  principalKind?: string;
  onSaved: (profile: IntegrationProfile) => void;
  onCancel?: () => void;
  onDeleted?: () => void;
  onOpenAccesses: () => void;
}) {
  const editing = !!initial.id;
  const [form, setForm] = useState<any>(() => ({
    ...draftFor(initial.preset || "azure"),
    ...initial,
    endpoint: initial.endpoint || (initial.preset ? presetDefaults[initial.preset]?.endpoint : "") || "",
    accessId: initial.accessId || "",
    audience: initial.audience || "",
    authMode: initial.preset === "arm" ? "delegated" : initial.authMode || draftFor(initial.preset || "azure").authMode,
  }));
  const [context, setContext] = useState<Record<string, string>>(() => ({ ...(initial.resourceContext || contextFor[initial.preset || "azure"] || {}) }));
  const [contextJson, setContextJson] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string }>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const independent = independentPresets.includes(form.preset);
  const native = nativePreset(form.preset);
  const field = (k: string, v: unknown) => setForm((f: any) => ({ ...f, [k]: v }));
  const setCtx = (k: string, v: string) => setContext((c) => ({ ...c, [k]: v }));

  function changePreset(preset: string) {
    setToken("");
    setForm({ ...draftFor(preset), name: form.name });
    setContext({ ...(contextFor[preset] || {}) });
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setNotice(undefined);
    try {
      let resourceContext = context;
      if (contextJson.trim()) resourceContext = JSON.parse(contextJson);
      const body: Record<string, unknown> = {
        name: form.name,
        preset: form.preset,
        transport: form.transport,
        endpoint: form.transport === "http" ? form.endpoint || undefined : undefined,
        accessId: independent ? undefined : form.accessId || undefined,
        authMode: form.authMode,
        audience: form.audience || undefined,
        tokenAction: token ? { kind: "replace", value: token } : { kind: "keep" },
        allowPrivateNetwork: !!form.allowPrivateNetwork,
        resourceContext,
        approvedTools: form.approvedTools || [],
        ...(editing ? { expectedVersion: form.configurationVersion ?? form.expectedVersion } : {}),
      };
      const saved = await manageRequest(`/mcp-connections${editing ? "/" + form.id : ""}`, editing ? "PATCH" : "POST", body);
      setToken("");
      setNotice({ kind: "ok", text: editing ? "Alterações salvas." : "Integração criada." });
      onSaved(saved);
    } catch (e) {
      setNotice({ kind: "error", text: e instanceof SyntaxError ? "O JSON de contexto não é válido." : (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await manageRequest(`/mcp-connections/${form.id}`, "DELETE");
      onDeleted?.();
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <form className="if" onSubmit={(e) => void save(e)}>
      <div className={`if-grid${independent ? " if-grid--two" : ""}`}>
        <fieldset className="if-card">
          <legend>1 · Serviço</legend>
          <label>
            Nome da integração
            <input required maxLength={120} value={form.name} onChange={(e) => field("name", e.target.value)} placeholder="Ex.: Azure Advisor — produção" />
          </label>
          <label>
            Serviço
            <select aria-label="Serviço" value={form.preset} disabled={editing} onChange={(e) => changePreset(e.target.value)}>
              {groups.map(([label, ids]) => (
                <optgroup key={label} label={label}>
                  {ids.map((id) => (
                    <option key={id} value={id}>
                      {presetDefaults[id]?.label || id}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {native ? (
            <p className="if-fine">
              {native.summary}{" "}
              <a href={native.docs} target="_blank" rel="noreferrer">
                Documentação oficial <ExternalLink size={11} aria-hidden="true" />
              </a>
            </p>
          ) : (
            <label>
              Transporte
              <select value={form.transport} onChange={(e) => field("transport", e.target.value)}>
                <option value="stdio">Local · STDIO (pacote oficial fixado)</option>
                <option value="http">Remoto · HTTPS (Streamable HTTP)</option>
              </select>
            </label>
          )}
          {native?.transport === "stdio" && (
            <p className="if-fine">
              <strong>Executa no host do Tesseract</strong> via <code>{native.runner?.command}</code>. {native.requires}
            </p>
          )}
          {form.transport === "http" && (
            <label>
              {native?.endpoint ? "URL do servidor (padrão oficial)" : "URL do servidor MCP"}
              <input type="url" required value={form.endpoint} onChange={(e) => field("endpoint", e.target.value)} placeholder="https://…" />
              {native?.endpointHint && <small className="if-fine">{native.endpointHint}</small>}
            </label>
          )}
          {form.transport === "http" && ["azure", "adx"].includes(form.preset) && (
            <label>
              Audience do servidor (api://…)
              <input required value={form.audience} onChange={(e) => field("audience", e.target.value)} />
            </label>
          )}
          {form.transport === "http" && (!native || !native.endpointPattern) && (
            <label className="if-check">
              <input type="checkbox" checked={!!form.allowPrivateNetwork} onChange={(e) => field("allowPrivateNetwork", e.target.checked)} /> Permitir rede privada / loopback para este endpoint
            </label>
          )}
        </fieldset>

        <fieldset className="if-card">
          <legend>2 · Autenticação</legend>
          {independent ? (
            <>
              {(native?.auth.length || 0) > 1 && (
                <label>
                  Autenticação do endpoint
                  <select value={form.authMode} onChange={(e) => field("authMode", e.target.value)}>
                    {native!.auth.includes("none") && <option value="none">Sem autenticação</option>}
                    {native!.auth.includes("serviceAccount") && <option value="serviceAccount">Conta de serviço (recomendado)</option>}
                    {native!.auth.includes("bearer") && <option value="bearer">Token Bearer próprio</option>}
                  </select>
                </label>
              )}
              {form.authMode === "none" && <p className="if-fine">Servidor público: nenhuma credencial é necessária.</p>}
              {form.authMode === "bearer" && (
                <label>
                  {native?.tokenLabel || "Token do endpoint"} {initial.tokenConfigured ? "(já protegido — deixe vazio para manter)" : ""}
                  <input type="password" autoComplete="new-password" value={token} onChange={(e) => setToken(e.target.value)} required={!initial.tokenConfigured} />
                  {native?.tokenHelp && <small className="if-fine">{native.tokenHelp}</small>}
                </label>
              )}
              {form.authMode === "serviceAccount" && (
                <label>
                  Chave JSON da conta de serviço {initial.tokenConfigured ? "— já protegida; cole só para substituir" : ""}
                  <textarea className="if-env" rows={5} spellCheck={false} autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder='{"type": "service_account", "client_email": "...", "private_key": "-----BEGIN PRIVATE KEY-----..."}' required={!initial.tokenConfigured} />
                  <small className="if-fine">Fica no cofre local (DPAPI). O Tesseract troca a chave por um token OAuth de 1 h e renova sozinho. Papéis: MCP Tool User, BigQuery Job User e Data Viewer no dataset de billing.</small>
                </label>
              )}
              {form.authMode === "env" && (
                <label>
                  Credenciais (uma por linha, CHAVE=valor) {initial.tokenConfigured ? "— já protegidas; preencha só para substituir" : ""}
                  <textarea
                    className="if-env"
                    rows={4}
                    spellCheck={false}
                    autoComplete="off"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={native?.envTemplate}
                    required={!initial.tokenConfigured}
                  />
                  {!token && native?.envTemplate && (
                    <button type="button" className="if-link" onClick={() => setToken(native.envTemplate!)}>
                      Inserir modelo para preencher →
                    </button>
                  )}
                  <small className="if-fine">Aceitas: {(native?.envKeys || []).join(", ")}. Ficam no cofre local (DPAPI) e só são entregues ao processo deste conector.</small>
                </label>
              )}
              <p className="if-fine">Este conector usa credencial própria e não recebe o login Azure.</p>
            </>
          ) : (
            <>
              <label>
                Credencial Azure
                <select required value={form.accessId} onChange={(e) => field("accessId", e.target.value)}>
                  <option value="">{accesses.length ? "Selecione" : "Nenhuma credencial cadastrada"}</option>
                  {accesses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="if-link" onClick={onOpenAccesses}>
                Gerenciar credenciais →
              </button>
              <label>
                Modo
                <select value={form.authMode} onChange={(e) => field("authMode", e.target.value)}>
                  <option value="delegated">Usuário delegado</option>
                  {form.preset !== "arm" && <option value="application">Identidade de aplicação</option>}
                </select>
              </label>
              {form.preset === "arm" && (
                <p className="if-fine">Depois de salvar, autorize o recurso (MCP.Access). Se o Entra retornar AADSTS650052, o administrador do tenant precisa disponibilizar o service principal do ARM MCP e o consentimento.</p>
              )}
            </>
          )}
        </fieldset>

        {!independent && (
        <fieldset className="if-card">
          <legend>3 · Escopo</legend>
          {form.preset === "azure" && form.transport === "stdio" && (
            <label>
              Grupo de tools
              <select aria-label="Grupo de tools a carregar" value={context.namespace || "pricing"} onChange={(e) => setCtx("namespace", e.target.value)}>
                {[...new Set(azureNamespaces.map((n) => n.group))].map((g) => (
                  <optgroup key={g} label={g}>
                    {azureNamespaces
                      .filter((n) => n.group === g)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label} ({n.id})
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
          {form.preset === "azure" && context.namespace === "advisor" && (
            <label>
              ID da assinatura
              <input value={context.subscription || ""} onChange={(e) => setCtx("subscription", e.target.value.trim())} pattern="[0-9a-fA-F-]{36}" placeholder="00000000-0000-0000-0000-000000000000" />
            </label>
          )}
          {form.preset === "arm" && (
            <ArmScopePicker
              authenticated={azureAuthenticated}
              identity={accesses.find((a) => a.id === activeAccessId)?.name || "a sessão ativa"}
              scope={context.scope || ""}
              onChange={(v) => setCtx("scope", v)}
            />
          )}
          {["adx", "powerbi", "fabric"].includes(form.preset) &&
            (form.preset === "adx" ? ["clusterUri", "database", "tenant", "subscription"] : form.preset === "powerbi" ? ["modelId", "workspaceId"] : ["workspaceId"]).map((k) => (
              <label key={k}>
                {k}
                <input value={context[k] || ""} onChange={(e) => setCtx(k, e.target.value)} />
              </label>
            ))}

          <details>
            <summary>Contexto em JSON (avançado)</summary>
            <textarea rows={5} placeholder={JSON.stringify(context, null, 2)} value={contextJson} onChange={(e) => setContextJson(e.target.value)} />
            <small className="if-fine">Se preenchido, substitui os campos acima. Os nomes devem corresponder aos parâmetros das tools.</small>
          </details>
        </fieldset>
        )}
      </div>

      <details className="if-summary">
        <summary>Resumo técnico</summary>
        <McpDetails profile={{ ...form, resourceContext: context }} />
      </details>

      {notice && (
        <p className={`tt-notice is-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}
      <div className="if-actions">
        <button className="lx-btn lx-btn--primary" disabled={busy}>
          <Save size={15} aria-hidden="true" /> {busy ? "Salvando…" : editing ? "Salvar alterações" : "Criar integração"}
        </button>
        {onCancel && (
          <button type="button" className="lx-btn" onClick={onCancel}>
            Cancelar
          </button>
        )}
        {editing && onDeleted && (
          <span className="if-danger">
            {confirmDelete ? (
              <>
                <span>Excluir esta integração e suas aprovações?</span>
                <button type="button" className="lx-btn lx-btn--danger" disabled={busy} onClick={() => void remove()}>
                  Confirmar exclusão
                </button>
                <button type="button" className="lx-btn" onClick={() => setConfirmDelete(false)}>
                  Manter
                </button>
              </>
            ) : (
              <button type="button" className="lx-btn lx-btn--ghost-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} aria-hidden="true" /> Excluir
              </button>
            )}
          </span>
        )}
      </div>
    </form>
  );
}

import { useState } from "react";
import { Box, Copy } from "lucide-react";
import { IntegrationFlow } from "./IntegrationFlow.js";
import {
  advisorListArguments,
  advisorListTool,
  advisorSubscriptionId,
} from "../../shared/advisor-quick-start.js";
import type {
  McpProfile,
  PublicAccessProfile,
  ToolDescriptor,
} from "../../shared/connections.js";
import type { Subscription } from "../../shared/contracts.js";
import { api, manageRequest } from "../api.js";
import { McpToolResult } from "./McpToolResult.js";

type AdvisorConnection = Pick<
  McpProfile,
  "id" | "name" | "accessId" | "resourceContext"
>;
type ListedTool = ToolDescriptor & { approved: boolean; reviewable: boolean };
type Discovery = { tools: ListedTool[]; connection: AdvisorConnection };

export function AdvisorQuickStart({
  accesses,
  activeAccessId,
  initialConnection,
  onConnectAccess,
  onPrepared,
  onActivity,
  onInspect,
  onAccesses,
}: {
  accesses: PublicAccessProfile[];
  activeAccessId?: string;
  initialConnection?: AdvisorConnection;
  onConnectAccess: (accessId: string) => Promise<void>;
  onPrepared: (connection: AdvisorConnection) => void;
  onActivity: () => void;
  onInspect: (connectionId: string) => void;
  onAccesses: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selection, setSelection] = useState<{
    accessId: string;
    subscription: string;
  }>();
  const [connection, setConnection] = useState<AdvisorConnection>();
  const [discovery, setDiscovery] = useState<Discovery>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    tool: string;
    connection: string;
    at: string;
    response: unknown;
  }>();
  const [copyStatus, setCopyStatus] = useState("");
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [inventory, setInventory] = useState<{
    accessId: string;
    items: Subscription[];
  }>();
  const compatible = accesses.filter((access) => access.secretConfigured);
  const accessId = selection?.accessId ?? initialConnection?.accessId ?? "";
  const subscription =
    selection?.subscription ??
    initialConnection?.resourceContext.subscription ??
    "";
  const scopedSubscriptions =
    inventory?.accessId === accessId ? inventory.items : [];
  const query = subscriptionSearch.trim().toLocaleLowerCase("pt-BR");
  const subscriptionMatches = scopedSubscriptions.filter((entry) =>
    `${entry.name} ${entry.id}`.toLocaleLowerCase("pt-BR").includes(query),
  );
  const selectedSubscription = scopedSubscriptions.find(
    (entry) => entry.id.toLowerCase() === subscription.toLowerCase(),
  );
  const currentConnection =
    connection ?? (selection ? undefined : initialConnection);
  const tool = discovery?.tools.find(
    (item) => advisorListTool.test(item.name) && item.reviewable,
  );
  const args =
    tool && advisorListArguments(tool, subscription.trim().toLowerCase());
  const ready = !!tool && !!args;

  function changeSelection(access: string, scope: string) {
    if (access !== accessId) setSubscriptionSearch("");
    setSelection({ accessId: access, subscription: scope });
    setConnection(undefined);
    setDiscovery(undefined);
    setResult(undefined);
    setCopyStatus("");
    setError("");
  }

  async function listSubscriptions() {
    if (busy || !accessId) return;
    setBusy("Buscando assinaturas disponíveis…");
    setError("");
    try {
      if (accessId !== activeAccessId) await onConnectAccess(accessId);
      const items = await api.subscriptions();
      setInventory({ accessId, items });
      if (!items.length)
        setError("Nenhuma assinatura encontrada para este acesso.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function discover(event: React.FormEvent) {
    event.preventDefault();
    if (
      busy ||
      !compatible.some((access) => access.id === accessId) ||
      !advisorSubscriptionId.test(subscription.trim())
    )
      return;
    setBusy("Conectando ao Azure Advisor e listando ferramentas…");
    setError("");
    setDiscovery(undefined);
    setResult(undefined);
    setCopyStatus("");
    try {
      if (accessId !== activeAccessId) {
        setBusy("Conectando o acesso de aplicação ao Azure…");
        await onConnectAccess(accessId);
        setBusy("Conectando ao Azure Advisor e listando ferramentas…");
      }
      const prepared = await manageRequest<AdvisorConnection>(
        "/mcp-connections/azure-advisor",
        "POST",
        { accessId, subscription: subscription.trim() },
      );
      setConnection(prepared);
      onPrepared(prepared);
      const { tools } = await manageRequest<{ tools: ListedTool[] }>(
        `/mcp-connections/${prepared.id}/test`,
        "POST",
        {},
      );
      setDiscovery({ tools, connection: prepared });
      onActivity();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function execute() {
    if (busy || !discovery || !tool || !args) return;
    setBusy("Consultando recomendações na assinatura selecionada…");
    setError("");
    setResult(undefined);
    setCopyStatus("");
    const path = `/mcp-connections/${discovery.connection.id}`;
    try {
      if (!tool.approved) {
        await manageRequest(`${path}/approve-tools`, "POST", {
          names: [tool.name],
          advisorSchemaHash: tool.schemaHash,
        });
        setDiscovery({
          ...discovery,
          tools: discovery.tools.map((item) =>
            item.name === tool.name ? { ...item, approved: true } : item,
          ),
        });
      }
      const response = await manageRequest(`${path}/call`, "POST", {
        name: tool.name,
        arguments: args,
        expectedSchemaHash: tool.schemaHash,
        confirmedExecution: true,
      });
      setResult({
        tool: tool.name,
        connection: discovery.connection.name,
        at: new Date().toLocaleString("pt-BR"),
        response,
      });
    } catch (cause) {
      setError((cause as Error).message);
      setDiscovery(undefined);
    } finally {
      setBusy("");
      onActivity();
    }
  }

  return (
    <section
      className="config-card"
      aria-labelledby="advisor-quick-start-title"
    >
      <h3 id="advisor-quick-start-title">Azure Advisor</h3>
      <p>Consulte recomendações da sua assinatura Azure.</p>
      {!(expanded || initialConnection) ? (
        <button
          type="button"
          className="primary"
          onClick={() => setExpanded(true)}
        >
          Usar acesso salvo
        </button>
      ) : compatible.length === 0 ? (
        <button type="button" className="primary" onClick={onAccesses}>
          Cadastrar acesso de aplicação
        </button>
      ) : (
        <form className="settings-form" onSubmit={discover}>
          <label>
            Acesso de aplicação
            <select
              required
              disabled={!!busy}
              value={accessId}
              onChange={(event) => changeSelection(event.target.value, "")}
            >
              <option value="">Selecione um acesso salvo</option>
              {compatible.map((access) => (
                <option key={access.id} value={access.id}>
                  {access.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assinatura Azure
            <input
              required
              disabled={!accessId || !!busy}
              value={subscription}
              pattern={advisorSubscriptionId.source.slice(1, -1)}
              placeholder="ID da assinatura"
              onChange={(event) =>
                changeSelection(accessId, event.target.value)
              }
            />
          </label>
          {selectedSubscription && <small>{selectedSubscription.name}</small>}
          {accessId && !scopedSubscriptions.length && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void listSubscriptions()}
            >
              Buscar assinaturas
            </button>
          )}
          {scopedSubscriptions.length > 0 && (
            <section
              className="advisor-subscriptions"
              aria-label="Assinaturas disponíveis"
            >
              <label>
                Buscar por nome ou ID
                <input
                  type="search"
                  value={subscriptionSearch}
                  disabled={!!busy}
                  onChange={(event) =>
                    setSubscriptionSearch(event.target.value)
                  }
                  placeholder="Ex.: desenvolvimento"
                />
              </label>
              <p className="fine" role="status">
                {subscriptionMatches.length} de {scopedSubscriptions.length}{" "}
                assinaturas
                {subscriptionMatches.length > 20
                  ? " · primeiras 20 exibidas"
                  : ""}
                .
              </p>
              <ul>
                {subscriptionMatches.slice(0, 20).map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      disabled={!!busy}
                      aria-pressed={
                        subscription.toLowerCase() === entry.id.toLowerCase()
                      }
                      onClick={() => {
                        changeSelection(accessId, entry.id);
                        setSubscriptionSearch(entry.name);
                      }}
                    >
                      <strong>{entry.name}</strong>
                      <small>{entry.id}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!discovery && (
            <>
              {accessId && accessId !== activeAccessId && (
                <small>O teste ativa o acesso selecionado nesta sessão.</small>
              )}
              <button
                type="submit"
                className="primary"
                disabled={!accessId || !!busy}
              >
                Conectar e testar
              </button>
            </>
          )}
        </form>
      )}
      {busy && (
        <p role="status" className="integration-progress">
          <Box size={19} aria-hidden="true" /> {busy}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {discovery && !result && !busy && !error && (
        <p role="status">
          {discovery.tools.length === 1
            ? "1 ferramenta encontrada."
            : `${discovery.tools.length} ferramentas encontradas.`}{" "}
          {ready
            ? "A consulta de recomendações está pronta para testar."
            : "A consulta guiada não está disponível. Veja as ferramentas no Inspetor."}
        </p>
      )}
      {discovery && (
        <details>
          <summary>Sobre as ferramentas encontradas</summary>
          <p>
            A lista vem do Azure MCP 3.0.0 em modo de leitura. A documentação da
            Microsoft também inclui operações de outras versões e de
            atualização.
          </p>
        </details>
      )}
      {result && <p role="status">Consulta de recomendações concluída.</p>}
      <div className="actions">
        {ready && (
          <button
            type="button"
            className="primary"
            disabled={!!busy}
            onClick={() => void execute()}
          >
            {tool.approved
              ? "Consultar recomendações"
              : "Autorizar e consultar recomendações"}
          </button>
        )}
        {currentConnection && (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => onInspect(currentConnection.id)}
          >
            Abrir Inspetor do Azure Advisor
          </button>
        )}
        {result && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  JSON.stringify(result.response, null, 2),
                );
                setCopyStatus("Resultado copiado.");
              } catch {
                setCopyStatus(
                  "Não foi possível copiar. Você pode selecionar o texto nos detalhes técnicos.",
                );
              }
            }}
          >
            <Copy aria-hidden="true" size={16} /> Copiar resultado
          </button>
        )}
      </div>
      {copyStatus && <p role="status">{copyStatus}</p>}
      {result && <McpToolResult result={result} guided />}
      {(expanded || initialConnection) && (
        <details>
          <summary>Como esta conexão funciona</summary>
          <IntegrationFlow
            accessName={
              compatible.find((access) => access.id === accessId)?.name
            }
            identityActive={!!accessId && accessId === activeAccessId}
            onAccess={onAccesses}
            onTools={
              currentConnection
                ? () => onInspect(currentConnection.id)
                : undefined
            }
          />
        </details>
      )}
    </section>
  );
}

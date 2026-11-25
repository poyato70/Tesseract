import { TesseractLoader } from "../flow/TesseractLoader.js";
import { useState } from "react";
import {
  ArrowDown,
  Box,
  Globe,
  KeyRound,
  Monitor,
  Network,
} from "lucide-react";
import type { DiagnosticEvent } from "../../server/diagnostics/service.js";
import type { MapProfile } from "./connections-map-model.js";

export function isAdvisor(profile?: MapProfile) {
  return (
    profile?.preset === "azure" &&
    profile.transport === "stdio" &&
    profile.resourceContext?.namespace === "advisor"
  );
}

type Props = {
  profile?: MapProfile;
  accessName?: string;
  identityActive?: boolean;
  events?: DiagnosticEvent[];
  onAccess?: () => void;
  onTools?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function IntegrationFlow({
  profile,
  accessName,
  identityActive,
  events = [],
  onAccess,
  onTools,
  onRefresh,
  refreshing,
}: Props) {
  const [selected, setSelected] = useState("mcp");
  const advisor = !profile || isAdvisor(profile);
  const local = !profile || profile.transport === "stdio";
  const requestPath = profile
    ? `POST /api/mcp-connections/${profile.id}/call`
    : undefined;
  const last = requestPath
    ? events.findLast(
        (event) => event.operation === requestPath && event.requestId,
      )
    : undefined;
  const outcome = last
    ? events.findLast(
        (event) =>
          event.requestId === last.requestId &&
          event.source === "MCP" &&
          event.status === "sucesso",
      )
    : undefined;
  const failed = last && /^[45]/.test(last.status);
  const connected = profile?.connected === true;
  const nodes = [
    {
      id: "browser",
      title: "Navegador",
      Icon: Monitor,
      state: "Sessão atual",
      detail: `Você abriu o Tesseract em ${window.location.origin}. O navegador recebe a resposta do serviço local.`,
    },
    {
      id: "tesseract",
      title: "Tesseract",
      Icon: Box,
      state: "Serviço local",
      detail:
        "Vincula o acesso, confere a política e o escopo. Envia apenas a ferramenta escolhida e os parâmetros da consulta ao MCP.",
    },
    {
      id: "mcp",
      title: advisor ? "Azure MCP · azmcp" : "Servidor MCP",
      Icon: Network,
      state: connected
        ? "Conectado nesta sessão"
        : profile
          ? "Sem conexão ativa nesta sessão"
          : "Configuração prevista",
      detail: local
        ? advisor
          ? "O Tesseract inicia @azure/mcp@3.0.0 com o grupo advisor em modo de leitura. As mensagens usam a entrada e saída do processo (STDIO). A consulta ao Azure usa HTTPS."
          : "O Tesseract inicia o servidor neste computador. As mensagens usam a entrada e saída do processo (STDIO)."
        : "O Tesseract conversa por HTTPS com o endpoint MCP cadastrado. A conexão e a execução de uma ferramenta têm estados independentes.",
      action: onTools,
      actionLabel: "Abrir ferramentas",
    },
    ...(advisor
      ? [
          {
            id: "identity",
            title: "Microsoft Entra ID",
            Icon: KeyRound,
            state: identityActive
              ? "Acesso ativo nesta sessão"
              : "Autenticação a verificar",
            detail: `${accessName ? `Acesso: ${accessName}. ` : ""}A identidade autoriza a consulta no Azure. O token de aplicação é obtido em login.microsoftonline.com; o Azure verifica as permissões da assinatura.`,
            action: onAccess,
            actionLabel: "Abrir Acessos",
          },
          {
            id: "cloud",
            title: "Azure Resource Graph",
            Icon: Globe,
            state:
              outcome && !failed
                ? "Última consulta concluída"
                : failed
                  ? "Última tentativa falhou"
                  : "Consulta a verificar",
            detail:
              "O azmcp consulta a tabela advisorresources via HTTPS em management.azure.com, no escopo da assinatura. A resposta volta ao Tesseract pelo processo local.",
            link: "https://learn.microsoft.com/en-us/rest/api/azureresourcegraph/resourcegraph/resources/resources",
          },
        ]
      : accessName
        ? [
            {
              id: "identity",
              title: "Acesso vinculado",
              Icon: KeyRound,
              state: identityActive
                ? "Ativo nesta sessão"
                : "Autenticação a verificar",
              detail: `${accessName} é a identidade vinculada. A autorização para cada operação depende do servidor e do escopo.`,
              action: onAccess,
              actionLabel: "Abrir Acessos",
            },
          ]
        : []),
  ];
  const node = nodes.find((item) => item.id === selected) || nodes[2];
  function renderNode(item: typeof node) {
    return (
      <button
        type="button"
        className="integration-node"
        aria-pressed={node.id === item.id}
        key={item.id}
        onClick={() => setSelected(item.id)}
      >
        <item.Icon aria-hidden="true" size={20} />
        <span>
          <strong>{item.title}</strong>
          <small>{item.state}</small>
        </span>
      </button>
    );
  }
  return (
    <div className="integration-flow">
      <div
        className="integration-flow-diagram"
        role="group"
        aria-label="Etapas da integração"
      >
        {renderNode(nodes[0])}
        <span className="integration-edge">
          <ArrowDown size={14} aria-hidden="true" /> HTTP local
        </span>
        {renderNode(nodes[1])}
        <span className="integration-edge">
          <ArrowDown size={14} aria-hidden="true" />{" "}
          {local ? "MCP via STDIO" : "MCP via HTTPS"}
        </span>
        {renderNode(nodes[2])}
        {nodes.length > 3 && (
          <>
            <span className="integration-edge">
              <ArrowDown size={14} aria-hidden="true" />{" "}
              {advisor ? "Token e consulta via HTTPS" : "Acesso utilizado"}
            </span>
            <div className="integration-branches">
              {nodes.slice(3).map(renderNode)}
            </div>
          </>
        )}
      </div>
      <aside className="integration-node-details" aria-live="polite">
        <h3>{node.title}</h3>
        <p>{node.detail}</p>
        {(node.action || ("link" in node && node.link)) && (
          <div className="actions">
            {node.action && (
              <button type="button" onClick={node.action}>
                {node.actionLabel}
              </button>
            )}
            {"link" in node && node.link && (
              <a href={node.link} target="_blank" rel="noreferrer">
                Documentação da API ↗
              </a>
            )}
          </div>
        )}
        {profile && (
          <div className="integration-last-run">
            <strong>Última consulta nesta sessão</strong>
            <p>
              {failed
                ? "Falha na última tentativa."
                : outcome
                  ? "Consulta concluída."
                  : "Sem execução confirmada no diagnóstico desta sessão."}
            </p>
            {last && (
              <small>
                {new Date(last.time).toLocaleString("pt-BR")} · Operação{" "}
                {last.requestId}
              </small>
            )}
            {onRefresh && (
              <div>
                <button type="button" disabled={refreshing} onClick={onRefresh}>
                  {refreshing ? <><TesseractLoader size={18} /> Atualizando…</> : "Atualizar estado"}
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

/**
 * "Como funciona esta conexão": separa o que roda no computador do que
 * trafega pela rede, com a frase que responde "quem consulta o quê".
 * Gerado a partir do cadastro — não depende de execução.
 */
import { ArrowDown, ArrowRight } from "lucide-react";
import { nativePreset } from "../../shared/mcp-catalog.js";
import { isAdvisorProfile, mcpServerLabel, targetLabel, type IntegrationProfile } from "./model.js";

type Box = { title: string; sub?: string };
export type Explanation = {
  sentence: string;
  local: { boxes: Box[]; links: string[] };
  /** Ligações que saem do computador para a rede. */
  bridge: string[];
  network: Box[];
  notes: string[];
};

export function explainConnection(p: IntegrationProfile, origin: string): Explanation {
  const native = nativePreset(p.preset);
  const stdio = p.transport === "stdio";
  const server = mcpServerLabel(p);
  const target = targetLabel(p);
  const host = (() => {
    try {
      return new URL(p.endpoint || native?.endpoint || "").host;
    } catch {
      return "";
    }
  })();
  const port = origin.replace(/^https?:\/\/[^:]+/, "") || "";
  const entra = p.authMode === "application" || p.authMode === "delegated";
  const tool = isAdvisorProfile(p) ? "advisor_recommendation_list" : "a tool aprovada";
  const local: Explanation["local"] = {
    boxes: [{ title: "Navegador" }, { title: `Tesseract ${port}`.trim(), sub: "serviço local" }],
    links: ["HTTP local"],
  };
  const network: Box[] = [];
  const bridge: string[] = [];
  const notes: string[] = [];
  let sentence: string;

  if (stdio) {
    local.boxes.push({ title: server.title, sub: "processo local" });
    local.links.push(`MCP via STDIO · tools/call: ${tool}`);
    if (entra) network.push({ title: "Entra ID", sub: "token de app" });
    if (p.authMode === "env") {
      local.boxes.push({ title: "Cofre local", sub: "credenciais do conector" });
      local.links.push("variáveis entregues ao processo");
    }
    network.push({ title: target.title, sub: target.subtitle });
    if (entra) bridge.push("token de app", "consulta com token");
    else bridge.push("consulta HTTPS com as credenciais do processo");
    sentence = `Quem consulta ${target.title} é o processo local ${server.title}. O Tesseract inicia esse processo e envia o pedido por STDIO; ${
      entra ? "o processo busca o token no Microsoft Entra ID e consulta o destino por HTTPS" : "o processo usa as credenciais cadastradas e consulta o destino por HTTPS"
    }.`;
    if (p.preset === "azure") notes.push("Não depende de az login, az advisor nem de módulo Azure do PowerShell.");
    if (native?.requires) notes.push(native.requires);
  } else {
    bridge.push(`MCP via HTTPS (${host || "endpoint"})`);
    network.push({ title: host || "Servidor MCP", sub: "servidor MCP remoto" });
    if (entra) network.unshift({ title: "Entra ID", sub: "token delegado/app" });
    network.push({ title: target.title, sub: target.subtitle });
    sentence = `Quem consulta ${target.title} é o servidor MCP remoto em ${host || "endpoint informado"}. O Tesseract envia o pedido por HTTPS${
      p.authMode === "bearer" ? " com o token cadastrado no cabeçalho Authorization" : entra ? " com o token emitido pelo Entra ID" : " sem credencial"
    }; nenhum processo é iniciado no computador.`;
    if (p.authMode === "bearer") notes.push("O token sai do cofre local somente para este host; troca de host é bloqueada.");
  }
  notes.push("O PowerShell só inicia o Tesseract; a consulta não passa por ele.");
  return { sentence, local, bridge, network, notes };
}

export function ConnectionExplainer({ profile, origin }: { profile: IntegrationProfile; origin: string }) {
  const x = explainConnection(profile, origin);
  return (
    <section className="cx" aria-label="Como funciona esta conexão">
      <p className="cx-sentence">{x.sentence}</p>
      <div className="cx-zone">
        <span className="cx-zone-name">No seu computador</span>
        <div className="cx-row">
          {x.local.boxes.map((b, i) => (
            <div className="cx-step" key={b.title + i}>
              {i > 0 && (
                <span className="cx-link">
                  <ArrowRight size={13} aria-hidden="true" />
                  <small>{x.local.links[i - 1]}</small>
                </span>
              )}
              <span className="cx-box">
                <b>{b.title}</b>
                {b.sub && <small>{b.sub}</small>}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="cx-bridge">
        <ArrowDown size={14} aria-hidden="true" />
        {x.bridge.map((b) => (
          <small key={b}>{b}</small>
        ))}
      </div>
      <div className="cx-zone is-net">
        <span className="cx-zone-name">Rede HTTPS</span>
        <div className="cx-row">
          {x.network.map((b, i) => (
            <span className="cx-box" key={b.title + i}>
              <b>{b.title}</b>
              {b.sub && <small>{b.sub}</small>}
            </span>
          ))}
        </div>
      </div>
      {x.notes.length > 0 && (
        <ul className="cx-notes">
          {x.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

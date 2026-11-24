import { useState } from "react";
import { Activity, ArrowRight, BookOpen, Bot, Boxes, Cloud, Coins, Container, Cpu, Database, FileJson, Gauge, GitBranch, Globe2, Lightbulb, Mail, MessageSquare, Network, Search, Server, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import { nativePreset } from "../../shared/mcp-catalog.js";
import { manageRequest } from "../api.js";
import { RegistrySearch } from "../components/RegistrySearch.js";
import { CloudDefaults } from "../components/CloudDefaults.js";
import { draftFor } from "./IntegrationForm.js";

type Card = {
  id: string;
  title: string;
  provider: string;
  transport: string;
  auth: string;
  supports: string;
  Icon: typeof Cloud;
  /** O que o usuário precisa informar. */
  needs: string;
  draft?: () => Record<string, any>;
  /** Ação alternativa (ex.: abrir Agentes ou Chat). */
  go?: { page: string; label: string; before?: () => void };
  guided?: boolean;
  tone?: "ready" | "public" | "internal";
};

const iconFor: Record<string, typeof Cloud> = {
  github: GitBranch,
  "github-local": GitBranch,
  mslearn: BookOpen,
  "aws-knowledge": BookOpen,
  "aws-billing": Coins,
  "aws-pricing": Coins,
  "gcp-bigquery": Database,
  openshift: Container,
  kubernetes: Server,
  custom: Globe2,
};

function nativeCard(id: string, over: Partial<Card> = {}): Card {
  const n = nativePreset(id)!;
  return {
    id,
    title: n.label,
    provider: n.provider,
    transport: n.transport === "http" ? `HTTPS · ${n.endpoint ? new URL(n.endpoint).host : "URL do servidor"}` : `Local · ${n.runner?.command}`,
    auth: n.auth.includes("env") ? "Credenciais em variáveis" : n.auth.includes("bearer") ? (n.auth.includes("none") ? "Token opcional" : "Token") : "Nenhuma",
    supports: n.summary,
    Icon: iconFor[id] || Server,
    needs: n.auth.includes("env") ? (n.envKeys || []).slice(0, 3).join(", ") : n.auth.includes("bearer") ? (n.endpoint ? "Token" : "URL e token") : n.endpoint ? "Nada — só criar" : "URL",
    tone: n.auth.length === 1 && n.auth[0] === "none" ? "public" : "ready",
    draft: () => draftFor(id, { name: n.label }),
    ...over,
  };
}

const azureNs = (id: string, title: string, supports: string, Icon: typeof Cloud): Card => ({
  id: "az-" + id,
  title,
  provider: "Microsoft Azure",
  transport: "Local · azmcp 3.0.0",
  auth: "Identidade de aplicação",
  needs: "Credencial Entra (app)",
  supports,
  Icon,
  tone: "ready",
  draft: () => draftFor("azure", { name: title, resourceContext: { namespace: id } }),
});

const internal = (id: string, title: string, supports: string, Icon: typeof Cloud): Card => ({
  id,
  title,
  provider: "Sistema interno",
  transport: "HTTPS · servidor MCP da equipe",
  auth: "Token Bearer",
  needs: "URL e token",
  supports,
  Icon,
  tone: "internal",
  draft: () => draftFor("custom", { name: title, authMode: "bearer" }),
});

const groups: { title: string; hint: string; cards: Card[] }[] = [
  {
    title: "Microsoft Azure · FinOps, recomendações e observabilidade",
    hint: "Usam uma credencial Entra cadastrada em Credenciais.",
    cards: [
      {
        id: "advisor",
        title: "Azure Advisor",
        provider: "Microsoft Azure",
        transport: "Local · azmcp 3.0.0",
        auth: "Identidade de aplicação",
        needs: "Credencial Entra + assinatura",
        supports: "Recomendações de custo, desempenho e segurança por assinatura.",
        Icon: Lightbulb,
        guided: true,
        tone: "ready",
        draft: () => draftFor("azure", { name: "Azure Advisor", resourceContext: { namespace: "advisor", subscription: "" } }),
      },
      {
        id: "arm",
        title: "Azure Cost Management",
        provider: "Microsoft Azure",
        transport: "HTTPS · ARM MCP",
        auth: "Login delegado (MCP.Access)",
        needs: "Login + escopo",
        supports: "Custos reais e amortizados, previsão e orçamentos no escopo escolhido.",
        Icon: Cloud,
        tone: "ready",
        draft: () => draftFor("arm", { name: "Azure Cost Management (ARM MCP)" }),
      },
      azureNs("pricing", "Azure Pricing", "Preços de catálogo e reservas para what-if. Não retorna gasto real.", Sparkles),
      azureNs("quota", "Azure Quota", "Cotas e uso por região — capacidade e limites.", Gauge),
      azureNs("monitor", "Azure Monitor", "Logs (KQL), métricas e saúde dos recursos — observabilidade contínua.", Activity),
      azureNs("resourcehealth", "Resource Health", "Disponibilidade e incidentes por recurso.", Activity),
      azureNs("policy", "Azure Policy", "Atribuições e conformidade de políticas (governança).", ShieldCheck),
      azureNs("foundry", "Foundry · modelos e tokens", "Deployments e modelos de IA — base para acompanhar consumo de tokens.", Cpu),
      {
        id: "adx",
        title: "FinOps Hub (Data Explorer)",
        provider: "Microsoft Azure",
        transport: "Local · azmcp 3.0.0",
        auth: "Aplicação ou delegado",
        needs: "Cluster e banco",
        supports: "Consultas KQL no FinOps Hub (FOCUS) — custos, showback e GreenOps.",
        Icon: Database,
        tone: "ready",
        draft: () => draftFor("adx", { name: "FinOps Hub (ADX)" }),
      },
      {
        id: "fabric",
        title: "Microsoft Fabric",
        provider: "Microsoft Fabric",
        transport: "HTTPS · MCP core",
        auth: "Login delegado",
        needs: "Login + workspace",
        supports: "Workspaces e itens Fabric autorizados.",
        Icon: Boxes,
        tone: "ready",
        draft: () => draftFor("fabric", { name: "Microsoft Fabric" }),
      },
      {
        id: "powerbi",
        title: "Power BI",
        provider: "Microsoft Fabric",
        transport: "HTTPS · MCP Power BI",
        auth: "Login delegado",
        needs: "Login + modelo semântico",
        supports: "Consultas em linguagem natural ao modelo semântico informado.",
        Icon: Boxes,
        tone: "ready",
        draft: () => draftFor("powerbi", { name: "Power BI" }),
      },
      {
        id: "foundry",
        title: "Microsoft Foundry (remoto)",
        provider: "Microsoft Azure",
        transport: "HTTPS · mcp.ai.azure.com",
        auth: "Login delegado",
        needs: "Login",
        supports: "Recursos e projetos Foundry autorizados.",
        Icon: Network,
        tone: "ready",
        draft: () => draftFor("foundry", { name: "Microsoft Foundry" }),
      },
    ],
  },
  {
    title: "GitHub e GitHub Copilot corporativos",
    hint: "Basta o token (PAT fine-grained ou GitHub App). Para GHE.com, troque o subdomínio na URL.",
    cards: [
      nativeCard("github"),
      nativeCard("github-local"),
      {
        id: "copilot-models",
        title: "Copilot corporativo · GitHub Models",
        provider: "GitHub",
        transport: "HTTPS · models.github.ai",
        auth: "Token corporativo (models:read)",
        needs: "Token e organização",
        supports: "Modelo para os agentes do Tesseract, com consumo atribuído à organização (chave impessoal).",
        Icon: Bot,
        tone: "ready",
        go: {
          page: "agents",
          label: "Criar agente",
          before: () => {
            try {
              sessionStorage.setItem("tesseract-agent-preset", "github-models");
            } catch {
              /* sem storage */
            }
          },
        },
      },
      {
        id: "copilot-local",
        title: "Copilot local · chave do usuário",
        provider: "GitHub",
        transport: "Local · Copilot CLI",
        auth: "Login GitHub do usuário",
        needs: "Copilot CLI autenticado",
        supports: "Chat do Tesseract usando a licença Copilot de quem está no computador.",
        Icon: MessageSquare,
        tone: "ready",
        go: { page: "chat", label: "Abrir chat" },
      },
    ],
  },
  {
    title: "Outras nuvens públicas",
    hint: "AWS roda localmente com uv; Google Cloud usa o servidor remoto oficial.",
    cards: [nativeCard("aws-billing"), nativeCard("aws-pricing"), nativeCard("gcp-bigquery")],
  },
  {
    title: "Nuvem privada",
    hint: "OpenShift e Kubernetes em modo somente leitura.",
    cards: [nativeCard("openshift"), nativeCard("kubernetes")],
  },
  {
    title: "Conhecimento",
    hint: "Servidores públicos: nenhuma credencial.",
    cards: [nativeCard("mslearn"), nativeCard("aws-knowledge")],
  },
  {
    title: "Sistemas internos",
    hint: "Não há servidor MCP oficial: aponte para o servidor que a sua equipe publicar.",
    cards: [
      internal("hive", "Apache Hive · DataCloud", "Consultas no DataCloud (Hive/Delfos) via servidor MCP interno, ex.: MCP Server Delfos.", Database),
      internal("db2", "IBM Db2", "Consultas de leitura em Db2 por um servidor MCP interno.", Database),
      internal("teams", "Microsoft Teams", "Notificações e bot de IA via servidor MCP interno (Graph).", MessageSquare),
      internal("smtp", "SMTP corporativo", "Envio de e-mails de alerta por um servidor MCP interno.", Mail),
      internal("ldap", "LDAP · AD · Kerberos", "Consulta de grupos e pessoas para showback por equipe.", Users),
      nativeCard("custom", { title: "Outro servidor MCP", tone: "internal" }),
    ],
  },
];

export function Catalog({
  onConfigure,
  onNavigate,
  advisorGuide,
}: {
  onConfigure: (draft: Record<string, any>) => void;
  onNavigate: (page: string) => void;
  /** Jornada guiada do Advisor (missão 21), aberta a partir do cartão. */
  advisorGuide: () => React.ReactNode;
}) {
  const [guide, setGuide] = useState(false);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"conectores" | "registry" | "avancado">("conectores");
  const [url, setUrl] = useState("");
  const [trust, setTrust] = useState(false);
  const [manifest, setManifest] = useState<any>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="cat">
      <section className="cat-intro">
        <div>
          <h2>Adicione uma integração</h2>
          <p>
            Escolha um serviço pronto, busque no MCP Registry oficial ou informe um manifesto. Toda integração vai para{" "}
            <button type="button" className="if-link" onClick={() => onNavigate("integrations")}>
              Minhas integrações
            </button>
            , onde você conecta, aprova e testa no mesmo lugar.
          </p>
        </div>
        <ol className="cat-flow" aria-label="Etapas de uma integração">
          {["Configurar", "Autenticar", "Conectar", "Aprovar", "Executar"].map((s, i) => (
            <li key={s}>
              <span>{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      {guide && (
        <section className="cat-guide" aria-label="Configuração guiada do Azure Advisor">
          <header>
            <h3>Configuração guiada · Azure Advisor</h3>
            <button type="button" className="lx-icon-btn" aria-label="Fechar configuração guiada" onClick={() => setGuide(false)}>
              <X size={16} />
            </button>
          </header>
          {advisorGuide()}
        </section>
      )}

      <div className="cat-tabs" role="tablist" aria-label="Seções do catálogo">
        {([
          ["conectores", "Conectores prontos"],
          ["registry", "MCP Registry oficial"],
          ["avancado", "Por provedor e manifesto"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "conectores" && (
      <>
      <div className="cat-filter">
        <Search size={15} aria-hidden="true" />
        <input aria-label="Filtrar conectores" placeholder="Filtrar conectores (ex.: github, custo, openshift)" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {groups.map((g) => {
        const q = filter.trim().toLowerCase();
        const cards = q ? g.cards.filter((c) => [c.title, c.provider, c.supports, c.transport].join(" ").toLowerCase().includes(q)) : g.cards;
        if (!cards.length) return null;
        return (
          <section key={g.title} className="cat-group" aria-label={g.title}>
            <header className="cat-group-head">
              <h3 className="cat-title">{g.title}</h3>
              <small>{g.hint}</small>
            </header>
            <div className="cat-grid">
              {cards.map((c) => (
                <article key={c.id} className={`cat-card cat-card--${c.id} is-${c.tone || "ready"}`}>
                  <header>
                    <span className="cat-icon">
                      <c.Icon size={18} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{c.title}</strong>
                      <small>{c.provider}</small>
                    </span>
                  </header>
                  <p>{c.supports}</p>
                  <dl>
                    <div>
                      <dt>Transporte</dt>
                      <dd>{c.transport}</dd>
                    </div>
                    <div>
                      <dt>Você informa</dt>
                      <dd>{c.needs}</dd>
                    </div>
                  </dl>
                  <div className="cat-actions">
                    {c.guided && (
                      <button type="button" className="lx-btn lx-btn--primary" onClick={() => setGuide(true)}>
                        Guiado
                      </button>
                    )}
                    {c.go ? (
                      <button
                        type="button"
                        className="lx-btn lx-btn--primary"
                        onClick={() => {
                          c.go!.before?.();
                          onNavigate(c.go!.page);
                        }}
                      >
                        {c.go.label} <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    ) : (
                      <button type="button" className={`lx-btn${c.guided ? "" : " lx-btn--primary"}`} onClick={() => onConfigure(c.draft!())}>
                        Configurar <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      </>
      )}

      {tab === "registry" && (
      <>
      <h3 className="cat-title">MCP Registry oficial</h3>
      <div className="cat-panel">
        <RegistrySearch onConfigure={onConfigure} />
      </div>

      </>
      )}

      {tab === "avancado" && (
      <>
      <h3 className="cat-title">Por provedor · APIs nativas e MCPs sugeridos</h3>
      <div className="cat-panel">
        <CloudDefaults onConfigure={onConfigure} onNavigate={onNavigate} />
      </div>

      <h3 className="cat-title">
        <FileJson size={16} aria-hidden="true" /> Manifesto por URL
      </h3>
      <div className="cat-panel">
        <p className="if-fine">
          Informe uma URL HTTPS de manifesto JSON no formato <code>{'{"servers":[{"name","url","description"}]}'}</code>. Não há navegação recursiva nem execução de comandos.
        </p>
        <form
          className="cat-manifest"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setManifest(undefined);
            try {
              setManifest(await manageRequest("/mcp-discovery", "POST", { url, trusted: trust }));
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            URL do manifesto
            <input type="url" required value={url} onChange={(e) => {
              setUrl(e.target.value);
              setTrust(false);
            }} />
          </label>
          <label className="if-check">
            <input type="checkbox" required checked={trust} onChange={(e) => setTrust(e.target.checked)} /> Confio nesta origem e assumo o risco de avaliar o conteúdo.
          </label>
          <button className="lx-btn" disabled={!trust || busy}>
            {busy ? "Consultando…" : "Descobrir manifesto"}
          </button>
        </form>
        {error && <p className="tt-notice is-error" role="alert">{error}</p>}
        {manifest?.servers?.map((s: any, i: number) => (
          <article className="cat-found" key={i}>
            <strong>{s.name}</strong>
            <p>{s.description}</p>
            <code>{s.url}</code>
            <button type="button" className="lx-btn" onClick={() => onConfigure(draftFor("custom", { name: s.name, endpoint: s.url }))}>
              Usar como servidor personalizado
            </button>
          </article>
        ))}
      </div>
      </>
      )}
    </div>
  );
}

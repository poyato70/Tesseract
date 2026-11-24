import { TesseractLoader } from "../flow/TesseractLoader.js";
import { useState } from "react";
import { ArrowRight, FlaskConical, Map as MapIcon, Plus, Search } from "lucide-react";
import type { DiagnosticEvent } from "../../server/diagnostics/service.js";
import { Ring } from "./LiveDiagram.js";
import { lifecycle, mcpServerLabel, providerLabel, sessionMetrics, type IntegrationProfile } from "./model.js";
import type { IntegrationTab } from "../shell/routes.js";

export function IntegrationsList({
  profiles,
  loaded,
  events,
  identityActive,
  onOpen,
  onCatalog,
  onAccesses,
}: {
  profiles: IntegrationProfile[];
  loaded: boolean;
  events: DiagnosticEvent[];
  identityActive: (p: IntegrationProfile) => boolean;
  onOpen: (id: string, tab?: IntegrationTab) => void;
  onCatalog: () => void;
  onAccesses: () => void;
}) {
  const [query, setQuery] = useState("");
  const list = profiles
    .filter((p) => p.id !== "default")
    .filter((p) => `${p.name} ${p.preset} ${p.endpoint || ""}`.toLowerCase().includes(query.toLowerCase()));
  if (loaded && profiles.filter((p) => p.id !== "default").length === 0)
    return (
      <section className="il-empty">
        <h2>Nenhuma integração ainda</h2>
        <p>Comece pelo catálogo: escolha um serviço, vincule uma credencial e teste uma leitura. O Tesseract funciona sem MCP; integrações são opcionais.</p>
        <button type="button" className="lx-btn lx-btn--primary" onClick={onCatalog}>
          <Plus size={15} aria-hidden="true" /> Abrir catálogo
        </button>
      </section>
    );
  return (
    <div className="il">
      <div className="il-toolbar">
        <label className="tt-search">
          <Search size={14} aria-hidden="true" />
          <input aria-label="Buscar integrações" placeholder="Buscar integrações…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <span className="il-legend" aria-hidden="true">
          <i className="is-online" /> Conectada <i className="is-pending" /> Requer ação <i className="is-idle" /> Desconectada
        </span>
        <button type="button" className="lx-btn" onClick={onAccesses}>
          Credenciais
        </button>
        <button type="button" className="lx-btn lx-btn--primary" onClick={onCatalog}>
          <Plus size={15} aria-hidden="true" /> Nova integração
        </button>
      </div>
      {!loaded && <div className="lx-loading"><TesseractLoader size={40} label="Carregando integrações…" /></div>}
      <div className="il-grid">
        {list.map((p) => {
          const life = lifecycle(p, { identityActive: identityActive(p), events });
          const metrics = sessionMetrics(events, p.id);
          const server = mcpServerLabel(p);
          const state = p.connected ? "online" : life.next && life.next.id === "identity" ? "pending" : "idle";
          return (
            <article key={p.id} className={`il-card is-${state}`}>
              <header>
                <Ring done={life.done} total={life.total} />
                <span className="il-title">
                  <button type="button" className="il-name" onClick={() => onOpen(p.id)}>
                    {p.name}
                  </button>
                  <small>
                    {providerLabel(p)} · {server.title}
                  </small>
                </span>
                <span className={`il-dot is-${state}`} aria-label={p.connected ? "Conectada" : "Desconectada"} />
              </header>
              <ol className="il-stages" aria-label="Etapas">
                {life.stages.map((s) => (
                  <li key={s.id} className={s.done ? "is-done" : ""} title={s.hint}>
                    {s.label}
                  </li>
                ))}
              </ol>
              <p className="il-next">
                {life.next ? (
                  <>
                    Próximo passo: <strong>{life.next.label}</strong> — {life.next.hint}
                  </>
                ) : (
                  <>Pronta. {metrics.executions} execução(ões) nesta sessão.</>
                )}
              </p>
              <footer>
                <button type="button" className="lx-btn" onClick={() => onOpen(p.id, "visao")}>
                  <MapIcon size={14} aria-hidden="true" /> Mapa
                </button>
                <button type="button" className="lx-btn" onClick={() => onOpen(p.id, "testar")}>
                  <FlaskConical size={14} aria-hidden="true" /> Testar
                </button>
                {life.next && (
                  <button
                    type="button"
                    className="lx-btn lx-btn--primary"
                    onClick={() => (life.next!.tab === "credenciais" ? onAccesses() : onOpen(p.id, life.next!.tab as IntegrationTab))}
                  >
                    {life.next.label} <ArrowRight size={14} aria-hidden="true" />
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}

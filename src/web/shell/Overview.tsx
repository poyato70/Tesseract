/**
 * Início · Centro operacional — o que está ligado e o que está acontecendo,
 * num diagrama vivo. Pulsos só aparecem onde o diagnóstico registrou atividade.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  Box,
  Cloud,
  Database,
  FlaskConical,
  KeyRound,
  Map as MapIcon,
  Monitor,
  Plug,
  Plus,
  RefreshCw,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";
import type { DiagnosticEvent } from "../../server/diagnostics/service.js";
import type { PublicAccessProfile } from "../../shared/connections.js";
import { manageRequest } from "../api.js";
import { FlowCanvas, type FlowNode, type Tone } from "../flow/FlowCanvas.js";
import { Ring } from "../flow/Ring.js";
import { activityBuckets, buildOperational, callSuccess, identityActiveFor, type OpNode } from "../flow/operational.js";
import type { IntegrationProfile } from "../integrations/model.js";
import type { IntegrationTab } from "./routes.js";

const look: Record<OpNode["kind"], { kind: FlowNode["kind"]; tone: Tone; icon: (s: number) => ReactNode }> = {
  client: { kind: "tile", tone: "cyan", icon: (s) => <Monitor size={s} /> },
  hub: { kind: "hub", tone: "violet", icon: (s) => <Box size={s} /> },
  identity: { kind: "tile", tone: "blue", icon: (s) => <ShieldCheck size={s} /> },
  bearer: { kind: "tile", tone: "amber", icon: (s) => <KeyRound size={s} /> },
  integration: { kind: "card", tone: "teal", icon: (s) => <Workflow size={s} /> },
  apis: { kind: "card", tone: "cyan", icon: (s) => <Cloud size={s} /> },
  target: { kind: "tile", tone: "purple", icon: (s) => <Database size={s} /> },
};

export function Overview({
  profiles,
  accesses,
  events,
  loaded,
  activeAccessId,
  principalKind,
  authenticated,
  onNavigate,
  onOpen,
  onRefresh,
  onActivateAccess,
}: {
  profiles: IntegrationProfile[];
  accesses: PublicAccessProfile[];
  events: DiagnosticEvent[];
  loaded: boolean;
  activeAccessId?: string;
  principalKind?: string;
  authenticated: boolean;
  onNavigate: (page: string) => void;
  onOpen: (id: string, tab?: IntegrationTab) => void;
  onRefresh: () => void;
  onActivateAccess: (id: string) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<string>();
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string }>();
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => setNow(Date.now()), [events, profiles]);

  const op = useMemo(
    () => buildOperational({ profiles, accesses, activeAccessId, principalKind, authenticated, events, now }),
    [profiles, accesses, activeAccessId, principalKind, authenticated, events, now],
  );
  const flowNodes: FlowNode[] = op.nodes.map((n) => {
    const l = look[n.kind];
    return {
      id: n.id,
      x: n.x,
      y: n.y,
      kind: l.kind,
      tone: l.tone,
      title: n.title,
      subtitle: n.subtitle,
      state: n.state,
      stateLabel: n.stateLabel,
      burst: n.burst,
      captionSide: n.kind === "target" ? "right" : undefined,
      icon: l.icon(l.kind === "hub" ? 26 : l.kind === "card" ? 17 : 19),
      extra: n.kind === "integration" && n.total ? <span className="fc-card-ring"><Ring done={n.done || 0} total={n.total} size={26} stroke={2.5} label={<small>{n.done}</small>} /></span> : undefined,
    };
  });
  const buckets = activityBuckets(events, now, 15);
  const peak = Math.max(1, ...buckets.map((b) => b.total));
  const success = callSuccess(events);
  const list = profiles.filter((p) => p.id !== "default");
  const node = op.nodes.find((n) => n.id === selected);
  const profile = node?.kind === "integration" ? list.find((p) => p.id === node.refId) : undefined;
  const lastEvent = events.length ? events.reduce((m, e) => (e.time > m.time ? e : m)) : undefined;
  const recent = [...events].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 6);

  async function toggle(p: IntegrationProfile) {
    setBusy(p.id);
    setNotice(undefined);
    try {
      if (p.connected) await manageRequest(`/mcp-connections/${p.id}/disconnect`, "POST", {});
      else {
        const r = await manageRequest(`/mcp-connections/${p.id}/test`, "POST", {});
        setNotice({ kind: "ok", text: `${p.name}: conectado, ${Array.isArray(r?.tools) ? r.tools.length : 0} tool(s) anunciada(s).` });
      }
    } catch (e) {
      setNotice({ kind: "error", text: `${p.name}: ${(e as Error).message}` });
    } finally {
      setBusy("");
      onRefresh();
    }
  }

  return (
    <div className="op">
      <header className="op-head">
        <div>
          <span className="ov-eyebrow">CENTRO OPERACIONAL</span>
          <h1>O que está ligado agora</h1>
        </div>
        <span className={`op-live${lastEvent && now - Date.parse(lastEvent.time) < 20000 ? " is-hot" : ""}`}>
          <i aria-hidden="true" /> Ao vivo · {new Date(now).toLocaleTimeString("pt-BR")}
        </span>
        <div className="op-actions">
          <button type="button" className="lx-btn lx-btn--ghost" onClick={onRefresh}>
            <RefreshCw size={15} aria-hidden="true" /> Atualizar
          </button>
          <button type="button" className="lx-btn lx-btn--primary" onClick={() => onNavigate("catalog")}>
            <Plus size={15} aria-hidden="true" /> Nova integração
          </button>
        </div>
      </header>

      <section className="op-canvas" aria-label="Diagrama operacional">
        <FlowCanvas
          nodes={flowNodes}
          edges={op.edges}
          width={op.width}
          height={op.height}
          selected={selected}
          onSelect={(id) => setSelected((s) => (s === id ? undefined : id))}
          onNodeDoubleClick={(id) => {
            const n = op.nodes.find((x) => x.id === id);
            if (n?.kind === "integration" && n.refId) onOpen(n.refId);
          }}
          ariaLabel="Topologia operacional do Tesseract"
          overlay={
            <>
              <div className="op-legend" aria-hidden="true">
                <span><i className="lg-run" /> Execução agora</span>
                <span><i className="lg-recent" /> Atividade recente</span>
                <span><i className="lg-err" /> Falha recente</span>
                <span><i className="lg-dash" /> Credencial pendente</span>
              </div>
              {loaded && !list.length && (
                <div className="op-empty">
                  <Plug size={20} aria-hidden="true" />
                  <span>Nenhuma integração MCP. As APIs Azure nativas já aparecem no mapa.</span>
                  <button type="button" className="lx-btn lx-btn--primary lx-btn--sm" onClick={() => onNavigate("catalog")}>
                    Abrir catálogo
                  </button>
                </div>
              )}
              {node && (
                <aside className="op-drawer" aria-label={`Detalhes de ${node.title}`}>
                  <header>
                    <span className={`op-dot is-${node.state}`} aria-hidden="true" />
                    <strong>{node.title}</strong>
                    <button type="button" className="lx-icon-btn" aria-label="Fechar detalhes" onClick={() => setSelected(undefined)}>
                      <X size={15} />
                    </button>
                  </header>
                  {node.subtitle && <p className="op-sub">{node.subtitle}</p>}
                  <p className="op-state">{node.stateLabel}</p>
                  {profile && (
                    <>
                      <Ring done={node.done || 0} total={node.total || 5} size={56} />
                      <div className="op-drawer-actions">
                        <button type="button" className="lx-btn lx-btn--primary lx-btn--sm" onClick={() => onOpen(profile.id)}>
                          <MapIcon size={13} aria-hidden="true" /> Abrir mapa
                        </button>
                        <button type="button" className="lx-btn lx-btn--sm" onClick={() => onOpen(profile.id, "testar")}>
                          <FlaskConical size={13} aria-hidden="true" /> Testar
                        </button>
                        <button type="button" className="lx-btn lx-btn--sm" disabled={busy === profile.id} onClick={() => void toggle(profile)}>
                          {profile.connected ? "Desconectar" : "Conectar"}
                        </button>
                      </div>
                    </>
                  )}
                  {node.kind === "identity" && node.refId && (
                    <div className="op-drawer-actions">
                      {node.state !== "online" && accesses.some((a) => a.id === node.refId) && (
                        <button type="button" className="lx-btn lx-btn--primary lx-btn--sm" onClick={() => onActivateAccess(node.refId!)}>
                          Ativar credencial
                        </button>
                      )}
                      <button type="button" className="lx-btn lx-btn--sm" onClick={() => onNavigate("accesses")}>
                        Credenciais
                      </button>
                    </div>
                  )}
                  {node.kind === "apis" && (
                    <div className="op-drawer-actions">
                      <button type="button" className="lx-btn lx-btn--primary lx-btn--sm" onClick={() => onNavigate("costs")}>
                        Abrir custos
                      </button>
                      <button type="button" className="lx-btn lx-btn--sm" onClick={() => onNavigate("multicloud")}>
                        Multicloud
                      </button>
                    </div>
                  )}
                  {(node.kind === "hub" || node.kind === "target" || node.kind === "client") && (
                    <div className="op-drawer-actions">
                      <button type="button" className="lx-btn lx-btn--sm" onClick={() => onNavigate("diagnostics")}>
                        <Activity size={13} aria-hidden="true" /> Atividade
                      </button>
                    </div>
                  )}
                </aside>
              )}
            </>
          }
        />
      </section>
      {notice && (
        <p className={`tt-notice is-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      <div className="op-widgets">
        <section className="nm-card op-activity">
          <header>
            <h2>Atividade · 15 min</h2>
            <small>{buckets.reduce((s, b) => s + b.total, 0)} eventos</small>
          </header>
          <div className="nm-bars" role="img" aria-label="Eventos por minuto nos últimos 15 minutos">
            {buckets.map((b, i) => (
              <span key={i} className="nm-bar" title={`${new Date(b.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · ${b.total} evento(s)`}>
                <i style={{ height: `${Math.max(4, (b.total / peak) * 100)}%` }} className={b.errors ? "has-error" : b.calls ? "has-call" : ""} />
              </span>
            ))}
          </div>
          <footer>
            <span><i className="dot-call" /> com execução de tool</span>
            <span><i className="dot-err" /> com falha</span>
          </footer>
        </section>

        <section className="nm-card op-success">
          <header>
            <h2>Execuções de tools</h2>
          </header>
          <div className="op-big-ring">
            <Ring
              done={success.ok}
              total={Math.max(success.total, 1)}
              size={150}
              stroke={12}
              label={<b>{success.total ? `${Math.round((success.ok / success.total) * 100)}%` : "—"}</b>}
            />
          </div>
          <p>
            {success.total ? `${success.ok} de ${success.total} concluídas nesta sessão` : "Nenhuma execução nesta sessão"}
          </p>
        </section>

        <section className="nm-card op-switches">
          <header>
            <h2>Conexões</h2>
            <button type="button" className="if-link" onClick={() => onNavigate("integrations")}>
              Todas →
            </button>
          </header>
          {!list.length && <p className="idt-empty">Nenhuma integração cadastrada.</p>}
          <ul>
            {list.slice(0, 6).map((p) => (
              <li key={p.id}>
                <button type="button" className="op-name" onClick={() => onOpen(p.id)}>
                  <strong>{p.name}</strong>
                  <small>{identityActiveFor(p, { activeAccessId, principalKind }) || p.authMode === "none" || p.authMode === "bearer" ? "Credencial ok" : "Credencial inativa"}</small>
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!p.connected}
                  aria-label={`${p.connected ? "Desconectar" : "Conectar"} ${p.name}`}
                  className={`nm-switch${p.connected ? " is-on" : ""}${busy === p.id ? " is-busy" : ""}`}
                  disabled={!!busy}
                  onClick={() => void toggle(p)}
                >
                  <i />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="nm-card op-feed">
          <header>
            <h2>Eventos recentes</h2>
            <button type="button" className="if-link" onClick={() => onNavigate("diagnostics")}>
              Atividade →
            </button>
          </header>
          {!recent.length && <p className="idt-empty">Sem eventos nesta sessão.</p>}
          <ol>
            {recent.map((e, i) => (
              <li key={i} className={/^[45]|fail|falh/i.test(e.status) ? "is-error" : ""}>
                <time>{new Date(e.time).toLocaleTimeString("pt-BR")}</time>
                <span>{e.operation.replace(/\/api\/mcp-connections\/[0-9a-f-]{36}/, "/mcp/…")}</span>
                <b>{e.status}</b>
              </li>
            ))}
          </ol>
          <button type="button" className="if-link" onClick={() => onNavigate("integrations")}>
            Gerenciar integrações <ArrowRight size={12} aria-hidden="true" />
          </button>
        </section>
      </div>
    </div>
  );
}

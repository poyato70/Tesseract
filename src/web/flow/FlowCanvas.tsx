/**
 * FlowCanvas — motor de diagrama vivo do Tesseract.
 *
 * Nós posicionados em coordenadas virtuais, conexões em curva (bezier) da
 * direita para a esquerda, pulsos de luz nas conexões com atividade real,
 * destaque do caminho ao passar o mouse, seleção, zoom e arraste.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";

export type Tone = "cyan" | "violet" | "orange" | "teal" | "blue" | "purple" | "gray" | "amber";
export type FlowState = "online" | "idle" | "pending" | "error" | "active";

export type FlowNode = {
  /** Legenda ao lado (direita) em vez de abaixo — usado na última coluna. */
  captionSide?: "right";
  id: string;
  x: number;
  y: number;
  /** tile = quadrado com rótulo abaixo; card = retângulo com texto; hub = núcleo; chip = círculo pequeno */
  kind: "tile" | "card" | "hub" | "chip";
  title: string;
  subtitle?: string;
  icon: ReactNode;
  tone: Tone;
  state: FlowState;
  stateLabel?: string;
  /** Explosão de sucesso (última execução concluída recentemente). */
  burst?: boolean;
  extra?: ReactNode;
  ariaLabel?: string;
};

export type FlowEdge = {
  id: string;
  from: string;
  to: string;
  tone?: Tone;
  /** run = pulsos contínuos; once = atividade recente; error = falha recente */
  pulse?: "run" | "recent" | "error";
  dashed?: boolean;
  label?: string;
  step?: number;
  note?: string;
  /** vertical = sai por baixo e entra por cima (sub-nós) */
  vertical?: boolean;
  /** Caminho de retorno: sai por baixo do nó, corre na linha y informada e entra por baixo do destino. */
  loop?: number;
};

/** Caixas compactas: a fonte não muda, só o volume das peças. */
export const size = {
  tile: { w: 46, h: 46 },
  hub: { w: 62, h: 62 },
  card: { w: 232, h: 54 },
  chip: { w: 32, h: 32 },
};
/** Espaço da legenda abaixo de tile/hub/chip. */
export const CAPTION = 34;

export function nodeBox(n: FlowNode) {
  const s = size[n.kind];
  return { left: n.x - s.w / 2, top: n.y - s.h / 2, w: s.w, h: s.h };
}

function port(n: FlowNode, side: "out" | "in" | "bottom" | "top") {
  const b = nodeBox(n);
  if (side === "out") return { x: b.left + b.w, y: n.y };
  if (side === "in") return { x: b.left, y: n.y };
  // nós com legenda abaixo (tile, hub, chip) saem por baixo da legenda
  if (side === "bottom") return { x: n.x, y: b.top + b.h + (n.kind === "card" || n.captionSide ? 0 : CAPTION) };
  return { x: n.x, y: b.top };
}

export function edgePath(a: FlowNode, b: FlowNode, vertical?: boolean, loop?: number) {
  if (loop !== undefined) {
    const p = port(a, "bottom");
    const q = port(b, "bottom");
    const r = 20;
    const dir = q.x < p.x ? -1 : 1;
    return `M ${p.x} ${p.y} L ${p.x} ${loop - r} Q ${p.x} ${loop} ${p.x + dir * r} ${loop} L ${q.x - dir * r} ${loop} Q ${q.x} ${loop} ${q.x} ${loop - r} L ${q.x} ${q.y + 6}`;
  }
  if (vertical) {
    const p = port(a, "bottom");
    const q = port(b, "top");
    const dy = Math.max(30, (q.y - p.y) / 2);
    return `M ${p.x} ${p.y} C ${p.x} ${p.y + dy}, ${q.x} ${q.y - dy}, ${q.x} ${q.y}`;
  }
  const backwards = b.x < a.x;
  const p = port(a, backwards ? "in" : "out");
  const q = port(b, backwards ? "out" : "in");
  const dx = Math.max(50, Math.abs(q.x - p.x) * 0.5);
  const s = backwards ? -1 : 1;
  return `M ${p.x} ${p.y} C ${p.x + dx * s} ${p.y}, ${q.x - dx * s} ${q.y}, ${q.x} ${q.y}`;
}

/** Ponto no meio da curva bezier (t = 0,5). */
function midpoint(a: FlowNode, b: FlowNode, vertical?: boolean, loop?: number) {
  if (loop !== undefined) return { x: (a.x + b.x) / 2, y: loop };
  if (vertical) {
    const p = port(a, "bottom");
    const q = port(b, "top");
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  }
  const p = port(a, b.x < a.x ? "in" : "out");
  const q = port(b, b.x < a.x ? "out" : "in");
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
}

export function FlowCanvas({
  nodes,
  edges,
  width,
  height,
  selected,
  onSelect,
  ariaLabel,
  minScale = 0.35,
  overlay,
  onNodeDoubleClick,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  width: number;
  height: number;
  selected?: string;
  onSelect?: (id: string) => void;
  ariaLabel: string;
  minScale?: number;
  overlay?: ReactNode;
  onNodeDoubleClick?: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const viewport = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [cw, setCw] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState<string>();
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | undefined>(undefined);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const el = viewport.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      setCw(el.clientWidth);
      // sem ampliação: em telas largas o diagrama fica no tamanho real e centralizado
      setFit(Math.min(1, Math.max(minScale, el.clientWidth / width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, minScale]);

  // Caminho destacado: nós e conexões ligados ao nó sob o mouse (ou selecionado).
  const focus = hover || selected;
  const hot = useMemo(() => {
    if (!focus) return undefined;
    const set = new Set<string>([focus]);
    // percorre para frente e para trás para iluminar o fluxo inteiro
    const walk = (dir: "f" | "b") => {
      const queue = [focus];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const e of edges) {
          const next = dir === "f" ? (e.from === cur ? e.to : undefined) : e.to === cur ? e.from : undefined;
          if (next && !set.has(next)) {
            set.add(next);
            queue.push(next);
          }
        }
      }
    };
    walk("f");
    walk("b");
    return set;
  }, [focus, edges]);

  const zoom = scale * fit;
  const onPointerDown = (ev: ReactPointerEvent) => {
    if ((ev.target as HTMLElement).closest("button,a")) return;
    drag.current = { x: ev.clientX, y: ev.clientY, ox: offset.x, oy: offset.y, moved: false };
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
  };
  const onPointerMove = (ev: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(ev.clientX - d.x) + Math.abs(ev.clientY - d.y) > 3) d.moved = true;
    setOffset({ x: d.ox + ev.clientX - d.x, y: d.oy + ev.clientY - d.y });
  };
  const endDrag = () => (drag.current = undefined);

  return (
    <div className="fc" data-focus={focus ? "true" : undefined}>
      <div
        ref={viewport}
        className="fc-viewport"
        style={{ height: Math.max(180, height * fit) }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={(e) => {
          if (!e.ctrlKey) return;
          e.preventDefault();
          setScale((s) => Math.min(2.2, Math.max(0.5, s - e.deltaY * 0.0015)));
        }}
        role="group"
        aria-label={ariaLabel}
      >
        <div className="fc-stage" style={{ width, height, transform: `translate(${offset.x + Math.max(0, (cw - width * zoom) / 2)}px, ${offset.y}px) scale(${zoom})` }}>
          <svg className="fc-edges" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            <defs>
              <filter id="fc-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.2" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {edges.map((e) => {
              const a = byId.get(e.from);
              const b = byId.get(e.to);
              if (!a || !b) return null;
              const d = edgePath(a, b, e.vertical, e.loop);
              const isHot = hot ? hot.has(e.from) && hot.has(e.to) : false;
              const dim = hot && !isHot;
              const tone = e.pulse === "error" ? "error" : e.tone || "gray";
              return (
                <g key={e.id} className={`fc-edge tone-${tone}${isHot ? " is-hot" : ""}${dim ? " is-dim" : ""}${e.dashed ? " is-dashed" : ""}`}>
                  <path className="fc-wire" d={d} id={`fc-${e.id}`} />
                  {e.pulse && !reduced && (
                    <>
                      <path className={`fc-comet pulse-${e.pulse}`} d={d} pathLength={1000} filter="url(#fc-glow)" />
                      <circle className="fc-head" r={e.pulse === "run" ? 4 : 3} filter="url(#fc-glow)">
                        <animateMotion dur={e.pulse === "run" ? "1.3s" : "2.6s"} repeatCount="indefinite">
                          <mpath href={`#fc-${e.id}`} />
                        </animateMotion>
                      </circle>
                    </>
                  )}
                  {e.pulse && reduced && <path className="fc-static-live" d={d} />}
                </g>
              );
            })}
            {/* portas nas extremidades */}
            {edges.map((e) => {
              const a = byId.get(e.from);
              const b = byId.get(e.to);
              if (!a || !b || e.vertical || e.loop !== undefined) return null;
              const p = port(a, b.x < a.x ? "in" : "out");
              const q = port(b, b.x < a.x ? "out" : "in");
              return (
                <g key={`p-${e.id}`} className="fc-ports">
                  <circle cx={p.x} cy={p.y} r={3} />
                  <circle cx={q.x} cy={q.y} r={3} />
                </g>
              );
            })}
          </svg>

          {edges
            .filter((e) => e.label || e.step)
            .map((e) => {
              const a = byId.get(e.from);
              const b = byId.get(e.to);
              if (!a || !b) return null;
              const m = midpoint(a, b, e.vertical, e.loop);
              const dim = hot && !(hot.has(e.from) && hot.has(e.to));
              return (
                <div key={`l-${e.id}`} className={`fc-label${dim ? " is-dim" : ""}`} style={{ left: m.x, top: m.y }}>
                  {e.step !== undefined && <span className="fc-step">{e.step}</span>}
                  {e.label && (
                    <span className="fc-label-text">
                      <b>{e.label}</b>
                      {e.note && <small>{e.note}</small>}
                    </span>
                  )}
                </div>
              );
            })}

          {nodes.map((n) => {
            const b = nodeBox(n);
            const dim = hot && !hot.has(n.id);
            return (
              <div
                key={n.id}
                className={`fc-node fc-${n.kind} tone-${n.tone}${n.captionSide ? " cap-right" : ""} is-${n.state}${selected === n.id ? " is-selected" : ""}${dim ? " is-dim" : ""}`}
                style={{ left: b.left, top: b.top, width: b.w, height: b.h }}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(undefined)}
              >
                {n.burst && !reduced && <span className="fc-burst" aria-hidden="true" />}
                <button
                  type="button"
                  className="fc-hit"
                  aria-pressed={selected === n.id}
                  aria-label={n.ariaLabel || `${n.title}${n.stateLabel ? ": " + n.stateLabel : ""}`}
                  onFocus={() => setHover(n.id)}
                  onBlur={() => setHover(undefined)}
                  onClick={() => {
                    if (drag.current?.moved) return;
                    onSelect?.(n.id);
                  }}
                  onDoubleClick={() => onNodeDoubleClick?.(n.id)}
                >
                  <span className="fc-icon">{n.icon}</span>
                  {n.kind === "card" && (
                    <span className="fc-card-text">
                      <strong>{n.title}</strong>
                      {n.subtitle && <small>{n.subtitle}</small>}
                      {n.stateLabel && (
                        <span className="fc-state">
                          <i aria-hidden="true" /> {n.stateLabel}
                        </span>
                      )}
                    </span>
                  )}
                </button>
                {n.kind !== "card" && (
                  <span className="fc-caption" aria-hidden="true">
                    <strong>{n.title}</strong>
                    {n.subtitle && <small>{n.subtitle}</small>}
                  </span>
                )}
                {n.kind !== "card" && <i className="fc-led" aria-hidden="true" />}
                {n.extra}
              </div>
            );
          })}
        </div>
      </div>
      <div className="fc-tools" role="toolbar" aria-label="Zoom do diagrama">
        <button type="button" aria-label="Diminuir zoom" onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}>
          <Minus size={15} />
        </button>
        <button type="button" aria-label="Aumentar zoom" onClick={() => setScale((s) => Math.min(2.2, s + 0.15))}>
          <Plus size={15} />
        </button>
        <button
          type="button"
          aria-label="Ajustar à tela"
          onClick={() => {
            setScale(1);
            setOffset({ x: 0, y: 0 });
          }}
        >
          <Maximize2 size={14} />
        </button>
      </div>
      {overlay}
    </div>
  );
}

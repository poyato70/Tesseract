/**
 * Mapa vivo de uma integração, desenhado no FlowCanvas: fluxo da esquerda
 * para a direita, tools aprovadas como sub-nós e o retorno por baixo.
 */
import { Box, Database, KeyRound, Link2, Monitor, ShieldCheck, Wrench } from "lucide-react";
import { FlowCanvas, type FlowEdge, type FlowNode, type Tone } from "../flow/FlowCanvas.js";
import type { GraphEdge, GraphNode, ListedTool, NodeKind } from "./model.js";

export { Ring } from "../flow/Ring.js";

const W = 1060;
const ROW = 118;
const TOOL_Y = 236;
const TOOL_GAP = 128;

const tones: Record<NodeKind, Tone> = { client: "cyan", service: "violet", mcp: "teal", identity: "blue", target: "purple" };

export function LiveDiagram({
  nodes,
  edges,
  selected,
  onSelect,
  live,
  running,
  failed,
  tools,
  onOpenTools,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selected: NodeKind;
  onSelect: (id: NodeKind) => void;
  live: boolean;
  running: boolean;
  failed?: boolean;
  tools?: ListedTool[];
  onOpenTools?: () => void;
}) {
  const identity = nodes.find((n) => n.id === "identity");
  const viaService = edges.some((e) => e.from === "service" && e.to === "identity");
  const pos: Record<NodeKind, { x: number; y: number }> = {
    client: { x: 60, y: ROW },
    service: { x: 270, y: ROW },
    mcp: { x: 560, y: ROW },
    identity: viaService ? { x: 560, y: 30 } : { x: 840, y: 40 },
    target: { x: 840, y: identity && !viaService ? 196 : ROW },
  };
  const flowNodes: FlowNode[] = nodes.map((n) => ({
    id: n.id,
    ...pos[n.id],
    kind: n.id === "mcp" ? "card" : n.id === "service" ? "hub" : "tile",
    tone: tones[n.id],
    title: n.title,
    subtitle: n.subtitle,
    state: running && n.id !== "client" ? "active" : n.state === "ready" ? "online" : n.state,
    stateLabel: n.stateLabel,
    burst: n.id === "target" && live && !running && !failed,
    captionSide: n.id === "target" || (n.id === "identity" && !viaService) ? "right" : undefined,
    icon:
      n.id === "client" ? <Monitor size={26} /> :
      n.id === "service" ? <Box size={34} /> :
      n.id === "mcp" ? <Link2 size={22} /> :
      n.id === "identity" ? (n.title === "Token Bearer" ? <KeyRound size={26} /> : <ShieldCheck size={26} />) :
      <Database size={26} />,
  }));
  const pulse: FlowEdge["pulse"] = running ? "run" : failed ? "error" : live ? "recent" : undefined;
  const flowEdges: FlowEdge[] = edges.map((e) => ({
    id: e.id,
    from: e.from,
    to: e.to,
    step: e.step,
    label: e.label,
    note: e.note,
    tone: e.returnPath ? "teal" : e.to === "identity" ? "blue" : e.to === "target" ? "purple" : e.from === "client" ? "cyan" : "violet",
    pulse: e.returnPath ? (running ? undefined : live && !failed ? "recent" : undefined) : e.to === "target" ? pulse : running ? "run" : live && !failed ? "recent" : undefined,
    dashed: e.returnPath,
    loop: undefined as number | undefined,
    returnPath: e.returnPath,
  }));

  // tools aprovadas (ou anunciadas) como sub-nós sob o servidor MCP
  const hasTools = !!tools && tools.length > 0;
  const lowest = Math.max(...flowNodes.map((n) => n.y));
  const H = Math.max(hasTools ? TOOL_Y + 96 : 0, lowest + 104);
  const shown = (tools || []).filter((t) => t.approved).slice(0, 4);
  const rest = (tools || []).length - shown.length;
  const startX = pos.mcp.x - ((shown.length + (rest > 0 ? 1 : 0) - 1) * TOOL_GAP) / 2;
  shown.forEach((t, i) => {
    flowNodes.push({
      id: `tool:${t.name}`,
      x: startX + i * TOOL_GAP,
      y: TOOL_Y,
      kind: "chip",
      tone: "teal",
      title: t.name.length > 18 ? t.name.slice(0, 17) + "…" : t.name,
      subtitle: "aprovada",
      state: running ? "active" : "online",
      icon: <Wrench size={14} />,
      ariaLabel: `Tool aprovada ${t.name}: abrir teste`,
    });
    flowEdges.push({ id: `tool-e:${t.name}`, from: "mcp", to: `tool:${t.name}`, vertical: true, tone: "teal", dashed: true, pulse: running ? "run" : undefined });
  });
  if (rest > 0 || (hasTools && !shown.length)) {
    flowNodes.push({
      id: "tool:more",
      x: shown.length ? startX + shown.length * TOOL_GAP : pos.mcp.x,
      y: TOOL_Y,
      kind: "chip",
      tone: "gray",
      title: shown.length ? `+${rest} tools` : `${tools?.length || 0} tools`,
      subtitle: shown.length ? "não aprovadas" : "nenhuma aprovada",
      state: "idle",
      icon: <Wrench size={14} />,
      ariaLabel: "Abrir aprovação de tools",
    });
    flowEdges.push({ id: "tool-e:more", from: "mcp", to: "tool:more", vertical: true, tone: "gray", dashed: true });
  }

  for (const e of flowEdges) if ((e as any).returnPath) e.loop = H - 22;
  return (
    <FlowCanvas
      nodes={flowNodes}
      edges={flowEdges.map(({ returnPath, ...e }: any) => e)}
      width={W}
      height={H}
      selected={selected}
      onSelect={(id) => (id.startsWith("tool:") ? onOpenTools?.() : onSelect(id as NodeKind))}
      ariaLabel="Mapa vivo da integração"
      minScale={0.34}
    />
  );
}

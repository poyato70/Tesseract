/**
 * Navegação em trilho de vidro que se esconde sozinha: mostra só ícones e
 * expande ao passar o mouse ou receber foco. Pode ser fixada aberta.
 * No celular vira uma barra inferior com um painel completo.
 */
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  Box,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  Pin,
  PinOff,
  Plug,
  WalletCards,
  X,
} from "lucide-react";
import { APP_VERSION } from "../../shared/version.js";

type Item = { id: string; label: string };
type Group = { id: string; label: string; Icon: typeof LayoutDashboard; items?: Item[]; first?: string };

export const menu: Group[] = [
  { id: "home", label: "Centro operacional", Icon: LayoutDashboard },
  {
    id: "g-integrations",
    label: "Integrações",
    Icon: Plug,
    first: "integrations",
    items: [
      { id: "integrations", label: "Minhas integrações" },
      { id: "catalog", label: "Catálogo" },
      { id: "accesses", label: "Credenciais" },
    ],
  },
  {
    id: "g-finops",
    label: "FinOps",
    Icon: WalletCards,
    first: "costs",
    items: [
      { id: "costs", label: "Custos" },
      { id: "tag-costs", label: "Por tag" },
      { id: "forecast", label: "Forecast" },
      { id: "budgets", label: "Budgets" },
      { id: "benefits", label: "Compromissos" },
      { id: "multicloud", label: "Multicloud" },
      { id: "copilot-seats", label: "Licenças Copilot" },
      { id: "hubs", label: "FinOps Hub" },
      { id: "finops-correlation", label: "Correlação MCP" },
      { id: "api-lab", label: "Laboratório de APIs" },
    ],
  },
  {
    id: "g-ai",
    label: "Agentes e IA",
    Icon: Bot,
    first: "chat",
    items: [
      { id: "chat", label: "Chat" },
      { id: "agents", label: "Agentes" },
      { id: "agent-lab", label: "Avaliação" },
      { id: "knowledge", label: "Conhecimento" },
      { id: "investigations", label: "Investigações" },
    ],
  },
  {
    id: "g-ops",
    label: "Operação",
    Icon: Activity,
    first: "diagnostics",
    items: [
      { id: "diagnostics", label: "Atividade" },
      { id: "new_features_ux", label: "Observabilidade" },
    ],
  },
];

export function groupOf(page: string) {
  if (page === "integration" || page === "integration-new") return "g-integrations";
  return menu.find((g) => g.items?.some((i) => i.id === page))?.id;
}

function readPinned() {
  try {
    return localStorage.getItem("tesseract-sidebar-pin") === "1";
  } catch {
    return false;
  }
}

export function Sidebar({
  page,
  onSelect,
  session,
  nextStep,
  recent,
  onLogout,
  onPinnedChange,
}: {
  page: string;
  onSelect: (id: string) => void;
  session: { label: string; detail: string; online: boolean };
  nextStep?: { title: string; detail: string; onClick: () => void };
  recent?: { id: string; name: string; active: boolean; onClick: () => void };
  onLogout?: () => void;
  onPinnedChange?: (pinned: boolean) => void;
}) {
  const [pinned, setPinned] = useState(readPinned);
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | undefined>(() => groupOf(page));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const open = pinned || hovered || mobileOpen;

  useEffect(() => {
    const g = groupOf(page);
    if (g) setOpenGroup(g);
  }, [page]);
  useEffect(() => {
    try {
      localStorage.setItem("tesseract-sidebar-pin", pinned ? "1" : "0");
    } catch {
      /* armazenamento indisponível */
    }
    onPinnedChange?.(pinned);
  }, [pinned]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const enter = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHovered(true), 90);
  };
  const leave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setHovered(false), 220);
  };
  const go = (id: string) => {
    onSelect(id);
    setMobileOpen(false);
    if (!pinned) setHovered(false);
  };

  return (
    <>
      <aside
        className={`sb${open ? " is-open" : ""}${pinned ? " is-pinned" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
        aria-label="Navegação principal"
        onMouseEnter={enter}
        onMouseLeave={leave}
        onFocus={() => {
          clearTimeout(timer.current);
          setHovered(true);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) leave();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setHovered(false);
            setMobileOpen(false);
            (document.activeElement as HTMLElement)?.blur();
          }
        }}
      >
        <div className="sb-glass">
          <header className="sb-head">
            <a
              className="sb-brand"
              href="/"
              onClick={(e) => {
                e.preventDefault();
                go("home");
              }}
            >
              <span className="sb-orb">
                <Box size={20} aria-hidden="true" />
              </span>
              <span className="sb-word">TESSERACT</span>
            </a>
            <button
              type="button"
              className="sb-pin"
              aria-pressed={pinned}
              aria-label={pinned ? "Soltar menu (esconder automaticamente)" : "Fixar menu aberto"}
              title={pinned ? "Esconder automaticamente" : "Fixar aberto"}
              onClick={() => setPinned(!pinned)}
            >
              {pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
            <button type="button" className="sb-close" aria-label="Fechar menu" onClick={() => setMobileOpen(false)}>
              <X size={18} />
            </button>
          </header>

          <div className="sb-profile" title={session.detail}>
            <span className="sb-avatar">
              <img src="/tesseract-symbol.png" alt="" width="30" height="30" />
              <i className={session.online ? "is-online" : ""} aria-hidden="true" />
            </span>
            <span className="sb-who">
              <strong>{session.label}</strong>
              <small>{session.detail}</small>
            </span>
          </div>

          <nav className="sb-nav">
            {menu.map((g) => {
              const active = g.items ? groupOf(page) === g.id : page === g.id;
              const expanded = open && openGroup === g.id;
              return (
                <div key={g.id} className={`sb-group${active ? " is-active" : ""}`}>
                  <button
                    type="button"
                    className="sb-parent"
                    aria-expanded={g.items ? expanded : undefined}
                    aria-current={!g.items && active ? "page" : undefined}
                    aria-label={g.label}
                    title={open ? undefined : g.label}
                    onClick={() => {
                      if (!g.items) return go(g.id);
                      if (!open) return go(g.first!);
                      setOpenGroup((cur) => (cur === g.id ? undefined : g.id));
                    }}
                  >
                    <span className="sb-icon">
                      <g.Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="sb-text">{g.label}</span>
                    {g.items && <ChevronDown size={15} className="sb-chev" aria-hidden="true" />}
                  </button>
                  {g.items && expanded && (
                    <ul className="sb-children">
                      {g.items.map((i) => (
                        <li key={i.id}>
                          <button type="button" className={page === i.id ? "is-current" : ""} aria-current={page === i.id ? "page" : undefined} onClick={() => go(i.id)}>
                            {i.label}
                          </button>
                        </li>
                      ))}
                      {g.id === "g-integrations" && recent && (
                        <li>
                          <button type="button" className={`sb-recent${recent.active ? " is-current" : ""}`} aria-current={recent.active ? "page" : undefined} onClick={() => {
                            recent.onClick();
                            setMobileOpen(false);
                          }}>
                            <ChevronRight size={13} aria-hidden="true" /> {recent.name}
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>

          {nextStep && (
            <button type="button" className="sb-next" onClick={() => {
              nextStep.onClick();
              setMobileOpen(false);
            }} title={`Próximo passo: ${nextStep.title}`}>
              <span className="sb-next-orb" aria-hidden="true">
                <ArrowRight size={16} />
              </span>
              <span className="sb-next-text">
                <small>PRÓXIMO PASSO</small>
                <strong>{nextStep.title}</strong>
                <em>{nextStep.detail}</em>
              </span>
            </button>
          )}

          <footer className="sb-foot">
            <button type="button" className={`sb-parent${page === "help" ? " is-current" : ""}`} aria-label="Guia e referências" title={open ? undefined : "Guia e referências"} onClick={() => go("help")}>
              <span className="sb-icon">
                <CircleHelp size={19} aria-hidden="true" />
              </span>
              <span className="sb-text">Guia e referências</span>
            </button>
            {onLogout && (
              <button type="button" className="sb-parent" aria-label="Encerrar sessão" title={open ? undefined : "Encerrar sessão"} onClick={onLogout}>
                <span className="sb-icon">
                  <LogOut size={19} aria-hidden="true" />
                </span>
                <span className="sb-text">Encerrar sessão</span>
              </button>
            )}
            <small className="sb-version">v{APP_VERSION}</small>
          </footer>
        </div>
      </aside>

      {/* barra inferior no celular */}
      <nav className="sb-dock" aria-label="Navegação rápida">
        {menu.slice(0, 4).map((g) => (
          <button
            key={g.id}
            type="button"
            className={(g.items ? groupOf(page) === g.id : page === g.id) ? "is-active" : ""}
            aria-label={g.label}
            onClick={() => go(g.first || g.id)}
          >
            <g.Icon size={20} aria-hidden="true" />
          </button>
        ))}
        <button type="button" aria-label="Abrir menu completo" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}>
          <Menu size={20} aria-hidden="true" />
        </button>
      </nav>
      {mobileOpen && <button type="button" className="sb-scrim" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
    </>
  );
}

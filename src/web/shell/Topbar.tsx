import { subscribeActivity } from "../activity.js";
import { TesseractLoader } from "../flow/TesseractLoader.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronRight, Search, ShieldCheck } from "lucide-react";
import { pages } from "./routes.js";

type Hit = { id: string; label: string; hint: string; go: () => void };

/** Barra superior em pílula de vidro: caminho, busca rápida, alertas e sessão. */
export function Topbar({
  crumbs,
  onCrumb,
  integrations,
  onNavigate,
  onOpenIntegration,
  alerts,
  session,
}: {
  crumbs: { label: string; page?: string }[];
  onCrumb: (page: string) => void;
  integrations: { id: string; name: string }[];
  onNavigate: (page: string) => void;
  onOpenIntegration: (id: string) => void;
  alerts: number;
  session: { label: string; online: boolean };
}) {
  const [busy, setBusy] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    return subscribeActivity((n) => {
      clearTimeout(timer);
      // pequeno atraso evita piscar em respostas instantâneas
      if (n > 0) timer = setTimeout(() => setBusy(n), 150);
      else setBusy(0);
    });
  }, []);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const fromPages = Object.entries(pages)
      .filter(([id, p]) => id !== "integration-new" && `${p.title} ${p.section}`.toLowerCase().includes(q))
      .map(([id, p]) => ({ id: `p:${id}`, label: p.title, hint: p.section, go: () => onNavigate(id) }));
    const fromIntegrations = integrations
      .filter((i) => i.name.toLowerCase().includes(q))
      .map((i) => ({ id: `i:${i.id}`, label: i.name, hint: "Integração", go: () => onOpenIntegration(i.id) }));
    return [...fromIntegrations, ...fromPages].slice(0, 8);
  }, [query, integrations, onNavigate, onOpenIntegration]);

  const pick = (h?: Hit) => {
    if (!h) return;
    h.go();
    setQuery("");
    setOpen(false);
    input.current?.blur();
  };

  return (
    <header className="tb">
      <nav aria-label="Caminho de navegação" className="tb-crumbs">
        {crumbs.map((c, i) => (
          <span key={i}>
            {i > 0 && <ChevronRight size={13} aria-hidden="true" />}
            {c.page && i < crumbs.length - 1 ? (
              <button type="button" onClick={() => onCrumb(c.page!)}>
                {c.label}
              </button>
            ) : (
              <span aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="tb-search" role="combobox" aria-expanded={open && hits.length > 0} aria-haspopup="listbox" aria-owns="tb-results">
        <Search size={15} aria-hidden="true" />
        <input
          ref={input}
          aria-label="Buscar páginas e integrações"
          aria-autocomplete="list"
          aria-controls="tb-results"
          placeholder="Buscar páginas e integrações…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setCursor(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(hits.length - 1, c + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(0, c - 1));
            } else if (e.key === "Enter") pick(hits[cursor]);
            else if (e.key === "Escape") {
              setQuery("");
              input.current?.blur();
            }
          }}
        />
        <kbd>Ctrl K</kbd>
        {open && hits.length > 0 && (
          <ul id="tb-results" role="listbox" className="tb-results">
            {hits.map((h, i) => (
              <li key={h.id} role="option" aria-selected={i === cursor} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}>
                <strong>{h.label}</strong>
                <small>{h.hint}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="tb-right">
        {busy ? (
          <span className="tb-activity" aria-live="polite">
            <TesseractLoader size={20} label={busy > 1 ? `${busy} execuções` : "Executando"} />
          </span>
        ) : (
          <span className="tb-chip" title="O Tesseract só executa leituras aprovadas">
            <ShieldCheck size={14} aria-hidden="true" /> Somente leitura
          </span>
        )}
        <button type="button" className="tb-icon" aria-label={alerts ? `${alerts} falha(s) recentes — abrir Atividade` : "Atividade"} onClick={() => onNavigate("diagnostics")}>
          <Bell size={17} aria-hidden="true" />
          {alerts > 0 && <b>{alerts}</b>}
        </button>
        <button type="button" className={`tb-session${session.online ? " is-online" : ""}`} onClick={() => onNavigate("accesses")} title="Credenciais">
          <i aria-hidden="true" />
          <span>{session.label}</span>
        </button>
      </div>
    </header>
  );
}

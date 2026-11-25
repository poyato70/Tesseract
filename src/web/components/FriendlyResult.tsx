import { useMemo, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { resultObject, resultTable, tableCsv, type ResultTable } from "../../shared/result-table.js";

const PAGE = 100;

function label(column: string) {
  // camelCase / dotted → rótulo legível, sem traduzir nomes do provedor
  return column.replace(/^properties\./, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\./g, " · ");
}

function show(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return v.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
  if (typeof v === "boolean") return v ? "sim" : "não";
  const s = String(v);
  // datas ISO em horário local
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  return s;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback para contextos sem a API de área de transferência
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ text, label: text2 = "Copiar" }: { text: () => string; label?: string }) {
  const [state, setState] = useState<"" | "ok" | "fail">("");
  return (
    <button
      type="button"
      className="fr-btn"
      onClick={async () => {
        setState((await copy(text())) ? "ok" : "fail");
        setTimeout(() => setState(""), 1800);
      }}
    >
      {state === "ok" ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      {state === "ok" ? "Copiado" : state === "fail" ? "Não foi possível copiar" : text2}
    </button>
  );
}

function TableView({ table }: { table: ResultTable }) {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<{ col: string; dir: 1 | -1 } | undefined>();
  const [limit, setLimit] = useState(PAGE);
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let out = q ? table.rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q))) : table.rows;
    if (sort)
      out = [...out].sort((a, b) => {
        const x = a[sort.col], y = b[sort.col];
        if (typeof x === "number" && typeof y === "number") return (x - y) * sort.dir;
        return String(x ?? "").localeCompare(String(y ?? ""), "pt-BR", { numeric: true }) * sort.dir;
      });
    return out;
  }, [table, filter, sort]);
  const csv = () => tableCsv({ ...table, rows });
  return (
    <div className="fr">
      <div className="fr-bar">
        <span className="fr-count">
          {table.total.toLocaleString("pt-BR")} registros em <code>{table.path || "resultado"}</code>
          {table.truncated && ` · ${table.rows.length.toLocaleString("pt-BR")} disponíveis (retorno acima de 128 kB)`}
          {filter && ` · ${rows.length.toLocaleString("pt-BR")} após o filtro`}
        </span>
        <input className="fr-filter" aria-label="Filtrar registros" placeholder="Filtrar…" value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(PAGE); }} />
        <CopyButton text={csv} label="Copiar tabela" />
        <button
          type="button"
          className="fr-btn"
          onClick={() => {
            const url = URL.createObjectURL(new Blob(["﻿" + csv()], { type: "text/csv;charset=utf-8" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `${table.path || "resultado"}.csv`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download size={13} aria-hidden="true" /> CSV
        </button>
      </div>
      <div className="fr-scroll">
        <table className="fr-table">
          <thead>
            <tr>
              {table.columns.map((c) => (
                <th key={c} aria-sort={sort?.col === c ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                  <button type="button" onClick={() => setSort((s) => (s?.col === c ? { col: c, dir: s.dir === 1 ? -1 : 1 } : { col: c, dir: 1 }))} title={c}>
                    {label(c)} {sort?.col === c ? (sort.dir === 1 ? "▲" : "▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((r, i) => (
              <tr key={i}>
                {table.columns.map((c) => (
                  <td key={c} className={typeof r[c] === "number" ? "is-num" : undefined}>{show(r[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <button type="button" className="fr-btn fr-more" onClick={() => setLimit((l) => l + PAGE)}>
          Mostrar mais {Math.min(PAGE, rows.length - limit)} de {rows.length - limit}
        </button>
      )}
    </div>
  );
}

/** Resposta técnica com alternância Tabela / JSON e botão de copiar. */
export function TechnicalResponse({ response, partial }: { response: any; partial: boolean }) {
  const raw = response?.result;
  const table = useMemo<ResultTable | undefined>(() => (partial ? raw?.table : resultTable(raw)), [raw, partial]);
  const object = useMemo(() => (table ? undefined : resultObject(raw)), [raw, table]);
  const friendly = !!(table?.rows.length || object);
  const [view, setView] = useState<"amigavel" | "json">(friendly ? "amigavel" : "json");
  const json = () => JSON.stringify(response, null, 2);
  return (
    <details className="fr-details">
      <summary>{partial ? "Ver resposta técnica disponível" : "Ver resposta técnica completa"}</summary>
      <div className="fr-tabs" role="tablist" aria-label="Formato da resposta">
        {friendly && (
          <button type="button" role="tab" aria-selected={view === "amigavel"} onClick={() => setView("amigavel")}>
            Visão amigável
          </button>
        )}
        <button type="button" role="tab" aria-selected={view === "json"} onClick={() => setView("json")}>
          JSON
        </button>
        <span className="fr-spacer" />
        <CopyButton text={json} label="Copiar resposta (JSON)" />
      </div>
      {view === "amigavel" && table?.rows.length ? (
        <TableView table={table} />
      ) : view === "amigavel" && object ? (
        <dl className="fr-dl">
          {object.fields.map(([k, v]) => (
            <div key={k}>
              <dt title={k}>{label(k)}</dt>
              <dd>{show(v)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <pre>{json()}</pre>
      )}
    </details>
  );
}

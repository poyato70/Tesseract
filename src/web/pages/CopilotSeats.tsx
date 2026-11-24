/**
 * FinOps · Licenças GitHub Copilot: assentos cobrados, ativos e ociosos.
 * Custo só é mostrado com o preço por assento informado (sem valor inventado).
 */
import { useState } from "react";
import { Bot, RefreshCw } from "lucide-react";
import { manageRequest } from "../api.js";
import { Ring } from "../flow/Ring.js";
import { TesseractLoader } from "../flow/TesseractLoader.js";
import type { IntegrationProfile } from "../integrations/model.js";

export function CopilotSeats({ profiles, onOpenCatalog }: { profiles: IntegrationProfile[]; onOpenCatalog: () => void }) {
  const github = profiles.filter((p) => ["github", "github-local"].includes(p.preset) && p.tokenConfigured);
  const [conn, setConn] = useState(github[0]?.id || "");
  const [org, setOrg] = useState("");
  const [idleDays, setIdleDays] = useState(30);
  const [price, setPrice] = useState("");
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const unit = Number(price.replace(",", "."));
  const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "USD" });

  async function load(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      setData(await manageRequest("/finops/copilot-seats", "POST", { mcpConnectionId: conn, org: org.trim(), idleDays }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!github.length)
    return (
      <section className="lx-panel cps-empty">
        <Bot size={22} aria-hidden="true" />
        <p>Cadastre uma integração GitHub com token (owner da organização, permissão <code>manage_billing:copilot</code> ou <code>read:org</code>) para ver as licenças Copilot.</p>
        <button type="button" className="lx-btn lx-btn--primary" onClick={onOpenCatalog}>
          Abrir catálogo
        </button>
      </section>
    );

  return (
    <div className="cps">
      <form className="lx-panel cps-form" onSubmit={(e) => void load(e)}>
        <label>
          Integração GitHub
          <select value={conn} onChange={(e) => setConn(e.target.value)}>
            {github.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Organização
          <input required value={org} onChange={(e) => setOrg(e.target.value)} placeholder="ex.: bancodobrasil" />
        </label>
        <label>
          Ocioso após (dias)
          <input type="number" min={7} max={90} value={idleDays} onChange={(e) => setIdleDays(Number(e.target.value) || 30)} />
        </label>
        <label>
          Preço por assento/mês (USD, do contrato)
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="opcional" />
        </label>
        <button className="lx-btn lx-btn--primary" disabled={busy || !conn}>
          {busy ? <TesseractLoader size={16} /> : <RefreshCw size={14} aria-hidden="true" />} {busy ? "Consultando…" : "Consultar licenças"}
        </button>
      </form>
      {error && (
        <p className="tt-notice is-error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <div className="cps-grid">
          <section className="nm-card cps-ring">
            <header>
              <strong>Uso das licenças</strong>
              <small>{data.planType ? `Plano ${data.planType}` : "Plano não informado"}</small>
            </header>
            <Ring done={data.active} total={Math.max(1, data.total)} size={120} stroke={10} label={<b>{data.total ? Math.round((data.active / data.total) * 100) : 0}%</b>} />
            <p>
              {data.active} de {data.total} assentos usados nos últimos {data.idleDays} dias
            </p>
          </section>
          <section className="nm-card">
            <header>
              <strong>Assentos</strong>
            </header>
            <dl className="cps-facts">
              <div><dt>Cobrados</dt><dd>{data.total}</dd></div>
              <div><dt>Ativos</dt><dd>{data.active}</dd></div>
              <div><dt>Ociosos</dt><dd>{data.idle}</dd></div>
              <div><dt>Nunca usados</dt><dd>{data.neverUsed}</dd></div>
              <div><dt>Cancelamento pendente</dt><dd>{data.pendingCancellation}</dd></div>
            </dl>
            {Number.isFinite(unit) && unit > 0 ? (
              <p className="cps-money">
                Custo mensal: <b>{money(unit * data.total)}</b> · ocioso: <b>{money(unit * data.idle)}</b>
              </p>
            ) : (
              <p className="idt-fine">Informe o preço por assento do seu contrato para estimar custo e desperdício.</p>
            )}
          </section>
          <section className="nm-card">
            <header>
              <strong>Ociosos (amostra)</strong>
              <small>até 20</small>
            </header>
            <ol className="cps-list">
              {data.idleSample.map((s: any) => (
                <li key={s.login}>
                  <b>{s.login}</b>
                  <small>{s.lastActivityAt ? `última atividade ${new Date(s.lastActivityAt).toLocaleDateString("pt-BR")}` : "nunca usou"}{s.team ? ` · ${s.team}` : ""}</small>
                </li>
              ))}
              {!data.idleSample.length && <li className="idt-empty">Nenhum assento ocioso.</li>}
            </ol>
          </section>
          <section className="nm-card">
            <header>
              <strong>Editores mais usados</strong>
            </header>
            <ol className="cps-list">
              {data.editors.map((e: any) => (
                <li key={e.name}>
                  <b>{e.name}</b>
                  <small>{e.seats} assentos</small>
                </li>
              ))}
            </ol>
            <p className="idt-fine">
              Fonte: {data.source} · {new Date(data.fetchedAt).toLocaleString("pt-BR")}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

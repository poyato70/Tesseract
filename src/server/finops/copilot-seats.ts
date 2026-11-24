/**
 * Licenças GitHub Copilot da organização: assentos cobrados, ativos e ociosos.
 * Fonte: REST "Copilot user management" (GET /orgs/{org}/copilot/billing e
 * /copilot/billing/seats). Nenhum preço é inventado: o custo só é calculado
 * com o valor por assento informado pelo usuário.
 */
import { AppError } from "../errors.js";
import { fetchBound } from "../security/endpoint-policy.js";

export type SeatSummary = {
  org: string;
  planType?: string;
  total: number;
  active: number;
  idle: number;
  neverUsed: number;
  pendingCancellation: number;
  idleDays: number;
  editors: { name: string; seats: number }[];
  idleSample: { login: string; lastActivityAt?: string; team?: string }[];
  source: string;
  fetchedAt: string;
};

/** api.github.com ou api.SUB.ghe.com, derivado do endpoint MCP do GitHub. */
export function githubApiBase(mcpEndpoint?: string) {
  const m = /^https:\/\/copilot-api\.([a-z0-9-]+)\.ghe\.com\//i.exec(mcpEndpoint || "");
  return m ? `https://api.${m[1].toLowerCase()}.ghe.com` : "https://api.github.com";
}

export function summarizeSeats(org: string, billing: any, seats: any[], now: number, idleDays = 30): Omit<SeatSummary, "source" | "fetchedAt"> {
  const limit = now - idleDays * 86_400_000;
  let active = 0,
    idle = 0,
    never = 0,
    pending = 0;
  const editors = new Map<string, number>();
  const idleSample: SeatSummary["idleSample"] = [];
  for (const s of seats) {
    if (s.pending_cancellation_date) pending++;
    const last = s.last_activity_at ? Date.parse(s.last_activity_at) : NaN;
    if (!Number.isFinite(last)) {
      never++;
      idle++;
      if (idleSample.length < 20) idleSample.push({ login: s.assignee?.login || "?", team: s.assigning_team?.name });
    } else if (last < limit) {
      idle++;
      if (idleSample.length < 20) idleSample.push({ login: s.assignee?.login || "?", lastActivityAt: s.last_activity_at, team: s.assigning_team?.name });
    } else active++;
    if (s.last_activity_editor) {
      const name = String(s.last_activity_editor).split("/")[0];
      editors.set(name, (editors.get(name) || 0) + 1);
    }
  }
  return {
    org,
    planType: billing?.plan_type,
    total: billing?.seat_breakdown?.total ?? seats.length,
    active,
    idle,
    neverUsed: never,
    pendingCancellation: billing?.seat_breakdown?.pending_cancellation ?? pending,
    idleDays,
    editors: [...editors].map(([name, n]) => ({ name, seats: n })).sort((a, b) => b.seats - a.seats).slice(0, 8),
    idleSample,
  };
}

export async function copilotSeats(token: string, org: string, apiBase: string, idleDays: number, signal?: AbortSignal, allowPrivate = false): Promise<SeatSummary> {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(org)) throw new AppError("invalid_request", "Nome de organização GitHub inválido.");
  const headers = { Accept: "application/vnd.github+json", Authorization: "Bearer " + token, "X-GitHub-Api-Version": "2022-11-28" };
  const get = async (path: string) => {
    const r = await fetchBound(apiBase + path, { headers, signal }, allowPrivate, false, true);
    if (r.status === 401 || r.status === 403 || r.status === 404) {
      await r.body?.cancel();
      throw new AppError(
        "auth_configuration",
        `GitHub recusou a leitura de licenças (HTTP ${r.status}). O token precisa de manage_billing:copilot ou read:org (classic) ou "GitHub Copilot Business: read" (fine-grained), e o usuário precisa ser owner da organização.`,
        r.status,
      );
    }
    if (!r.ok) {
      await r.body?.cancel();
      throw new AppError("upstream", `GitHub respondeu HTTP ${r.status} ao listar licenças.`, 502);
    }
    return r.json() as Promise<any>;
  };
  const billing = await get(`/orgs/${org}/copilot/billing`);
  const seats: any[] = [];
  for (let page = 1; page <= 20; page++) {
    const r = await get(`/orgs/${org}/copilot/billing/seats?per_page=100&page=${page}`);
    seats.push(...(r.seats || []));
    if (!r.seats?.length || seats.length >= (r.total_seats ?? 0)) break;
  }
  return { ...summarizeSeats(org, billing, seats, Date.now(), idleDays), source: `${apiBase}/orgs/${org}/copilot/billing`, fetchedAt: new Date().toISOString() };
}

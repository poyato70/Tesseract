import { expect, it } from "vitest";
import { githubApiBase, summarizeSeats } from "../../src/server/finops/copilot-seats.js";

it("resume assentos ativos, ociosos e nunca usados sem inventar custo", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");
  const seats = [
    { assignee: { login: "ana" }, last_activity_at: "2026-11-20T10:00:00Z", last_activity_editor: "vscode/1.99" },
    { assignee: { login: "bia" }, last_activity_at: "2026-09-01T10:00:00Z", last_activity_editor: "jetbrains/2026" },
    { assignee: { login: "caio" }, pending_cancellation_date: "2026-12-01" },
  ];
  const s = summarizeSeats("bb", { plan_type: "business", seat_breakdown: { total: 3, pending_cancellation: 1 } }, seats, now, 30);
  expect(s).toMatchObject({ total: 3, active: 1, idle: 2, neverUsed: 1, pendingCancellation: 1, planType: "business" });
  expect(s.idleSample.map((x) => x.login)).toEqual(["bia", "caio"]);
  expect(s.editors[0]).toEqual({ name: "vscode", seats: 1 });
  expect(JSON.stringify(s)).not.toMatch(/cost|price|preço/i);
});

it("deriva a API do GHE.com a partir do endpoint MCP", () => {
  expect(githubApiBase("https://copilot-api.octocorp.ghe.com/mcp")).toBe("https://api.octocorp.ghe.com");
  expect(githubApiBase("https://api.githubcopilot.com/mcp/")).toBe("https://api.github.com");
});

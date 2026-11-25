import { expect, it } from "vitest";
import { reviewable, reviewReason } from "../../src/server/mcp/tool-policy.js";
import { azmcpPackage } from "../../src/shared/mcp-catalog.js";
import { toolHint } from "../../src/shared/tool-hints.js";

// Anotações reais do @azure/mcp 4.0.0-beta.10 (--mode all --namespace advisor),
// coletadas em 25/11/2026. Sem --read-only, o servidor anuncia 9 tools.
const ro = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const advisor = [
  ["advisor_insight_list", ro],
  ["advisor_metadata_get", ro],
  ["advisor_metadata_list", ro],
  ["advisor_recommendation_list", ro],
  ["advisor_recommendation_prevalidate", ro],
  ["advisor_recommendation_summary", ro],
  ["advisor_recommendation_update", { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }],
  ["advisor_remediation_get", ro],
  ["advisor_servicegroupintelligence_get", ro],
] as const;
const profile: any = { preset: "azure", resourceContext: { namespace: "advisor" } };

it("aprova pelas anotações oficiais: 8 leituras sim, update (destrutiva) não", () => {
  const ok = advisor.filter(([name, annotations]) => reviewable(profile, { name, annotations, inputSchema: {}, schemaHash: "h" } as any)).map(([n]) => n);
  expect(ok).toHaveLength(8);
  expect(ok).not.toContain("advisor_recommendation_update");
  expect(reviewReason(profile, { name: "advisor_recommendation_update", annotations: advisor[6][1], inputSchema: {}, schemaHash: "h" } as any)).toMatch(/escrita|destrutiva/);
});

it("sem anotação de leitura continua dependendo da lista revisada", () => {
  expect(reviewable(profile, { name: "advisor_metadata_list", inputSchema: {}, schemaHash: "h" } as any)).toBe(false);
  expect(reviewable(profile, { name: "advisor_metadata_list", annotations: { ...ro, secretHint: true }, inputSchema: {}, schemaHash: "h" } as any)).toBe(false);
});

it("fixa só versões conhecidas do azmcp e tem dica para cada tool do Advisor", () => {
  expect(azmcpPackage("4.0.0-beta.10")).toBe("@azure/mcp@4.0.0-beta.10");
  expect(azmcpPackage("latest")).toBe("@azure/mcp@3.0.0");
  for (const [name] of advisor) expect(toolHint(name)?.purpose).toBeTruthy();
});

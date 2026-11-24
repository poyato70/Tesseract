import { describe, expect, it } from "vitest";
import { nativePreset, nativePresets, parseEnvSecret, presetIds } from "../../src/shared/mcp-catalog.js";
import { mcpInput } from "../../src/shared/connections.js";
import { McpRegistry } from "../../src/server/mcp/registry.js";
import { Invalidation } from "../../src/server/connections/invalidation.js";
import { capability } from "../../src/server/mcp/presets.js";
import { reviewable } from "../../src/server/mcp/tool-policy.js";
import { findOnPath } from "../../src/server/mcp/runner.js";
import { githubModelsPath, isGithubModels } from "../../src/server/agents/model-provider.js";
import { copilotConfig } from "../../src/web/integrations/CopilotExport.js";
import { explainConnection } from "../../src/web/integrations/ConnectionExplainer.js";

function registry() {
  const snapshot: any = { schemaVersion: 1, accessProfiles: [], mcpProfiles: [], agentProfiles: [] };
  const store: any = { read: async () => structuredClone(snapshot), mutate: async (fn: any) => fn(snapshot) };
  const values = new Map<string, string>();
  const vault: any = {
    put: async (v: string) => {
      const ref = "ref" + values.size;
      values.set(ref, v);
      return ref;
    },
    read: async (ref: string) => values.get(ref),
    remove: async (ref: string) => values.delete(ref),
  };
  return { reg: new McpRegistry(store, vault, {} as any, new Invalidation(store), {} as any), values, snapshot };
}

describe("catálogo nativo", () => {
  it("todo preset nativo é aceito pelo schema e tem documentação oficial", () => {
    for (const n of nativePresets) {
      expect(presetIds).toContain(n.id);
      expect(n.docs).toMatch(/^https:\/\//);
      if (n.transport === "stdio") expect(n.runner).toBeDefined();
    }
    expect(() => mcpInput.parse({ name: "x", preset: "github", transport: "http", authMode: "bearer" })).not.toThrow();
  });

  it("aceita só os endpoints oficiais do GitHub (github.com e ghe.com)", () => {
    const re = new RegExp(nativePreset("github")!.endpointPattern!, "i");
    expect(re.test("https://api.githubcopilot.com/mcp/")).toBe(true);
    expect(re.test("https://copilot-api.octocorp.ghe.com/mcp")).toBe(true);
    expect(re.test("https://evil.example.com/mcp")).toBe(false);
    expect(re.test("https://api.githubcopilot.com.evil.com/mcp/")).toBe(false);
  });

  it("filtra variáveis de ambiente pela lista do conector", () => {
    const env = parseEnvSecret("# comentário\nAWS_ACCESS_KEY_ID=AKIA\nAWS_SECRET_ACCESS_KEY = s3cr3t\nPATH=/tmp/evil\nAWS_REGION=\n", nativePreset("aws-billing")!.envKeys!);
    expect(env).toEqual({ AWS_ACCESS_KEY_ID: "AKIA", AWS_SECRET_ACCESS_KEY: "s3cr3t" });
  });

  it("salva conector AWS com credenciais protegidas e rejeita variáveis não permitidas", async () => {
    const { reg, values } = registry();
    await expect(
      reg.save({ name: "aws", preset: "aws-billing", transport: "stdio", authMode: "env", tokenAction: { kind: "replace", value: "PATH=/x" } }),
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(reg.save({ name: "aws", preset: "aws-billing", transport: "http", authMode: "env" })).rejects.toMatchObject({ code: "invalid_request" });
    const saved: any = await reg.save({
      name: "aws",
      preset: "aws-billing",
      transport: "stdio",
      authMode: "env",
      tokenAction: { kind: "replace", value: "AWS_PROFILE=finops\nAWS_REGION=us-east-1" },
    });
    expect(saved.tokenConfigured).toBe(true);
    expect(saved).not.toHaveProperty("tokenRef");
    expect([...values.values()][0]).toContain("AWS_PROFILE=finops");
    expect(capability(saved).status).toBe("pending");
  });

  it("recusa endpoint fora do padrão oficial antes de qualquer acesso à rede", async () => {
    const { reg } = registry();
    await expect(
      reg.save({ name: "gh", preset: "github", transport: "http", endpoint: "https://evil.example.com/mcp", authMode: "bearer", tokenAction: { kind: "replace", value: "ghp_x" } }),
    ).rejects.toMatchObject({ code: "invalid_endpoint" });
    await expect(
      reg.save({ name: "gh", preset: "github", transport: "http", endpoint: "https://api.githubcopilot.com/mcp/", authMode: "none" }),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("aprovação: servidores de documentação aceitam tools sem anotação; GitHub exige readOnlyHint", () => {
    const tool: any = { name: "microsoft_docs_search", inputSchema: {}, schemaHash: "h" };
    expect(reviewable({ preset: "mslearn" } as any, tool)).toBe(true);
    expect(reviewable({ preset: "github" } as any, { ...tool, name: "get_file_contents" })).toBe(false);
    expect(reviewable({ preset: "github" } as any, { ...tool, name: "get_file_contents", annotations: { readOnlyHint: true } })).toBe(true);
    expect(reviewable({ preset: "github" } as any, { ...tool, name: "create_issue", annotations: { readOnlyHint: true } })).toBe(false);
  });

  it("explica executor ausente sem procurar fora do PATH informado", async () => {
    expect(await findOnPath("uvx-inexistente", { PATH: "" } as any)).toBeUndefined();
  });

  it("GitHub Models aceita /inference e /orgs/ORG/inference", () => {
    expect(isGithubModels(new URL("https://models.github.ai/orgs/bb/inference"))).toBe(true);
    expect(githubModelsPath.test("/orgs/bb-finops/inference")).toBe(true);
    expect(githubModelsPath.test("/inference")).toBe(true);
    expect(githubModelsPath.test("/catalog/models")).toBe(false);
    expect(isGithubModels(new URL("https://models.github.ai.evil.com/inference"))).toBe(false);
  });

  it("exporta mcp.json para o Copilot sem segredos", () => {
    const json = copilotConfig({ id: "1", name: "GitHub BB", preset: "github", transport: "http", endpoint: "https://api.githubcopilot.com/mcp/", authMode: "bearer", tokenConfigured: true } as any);
    const cfg = JSON.parse(json);
    expect(cfg.servers["github-bb"].headers.Authorization).toBe("Bearer ${input:github-bb-token}");
    expect(cfg.inputs[0].password).toBe(true);
    const az = JSON.parse(copilotConfig({ id: "2", name: "Advisor", preset: "azure", transport: "stdio", authMode: "application", resourceContext: { namespace: "advisor" } } as any));
    expect(az.servers.advisor.args).toEqual(expect.arrayContaining(["--namespace", "advisor", "--read-only"]));
    expect(JSON.stringify(az)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
  });

  it("explica quem consulta o destino em cada transporte", () => {
    const stdio = explainConnection({ id: "a", name: "Advisor", preset: "azure", transport: "stdio", authMode: "application", resourceContext: { namespace: "advisor" } } as any, "http://127.0.0.1:4317");
    expect(stdio.sentence).toContain("processo local azmcp");
    expect(stdio.network.map((b) => b.title)).toEqual(["Entra ID", "Azure Resource Graph"]);
    const http = explainConnection({ id: "b", name: "GH", preset: "github", transport: "http", endpoint: "https://api.githubcopilot.com/mcp/", authMode: "bearer" } as any, "http://127.0.0.1:4317");
    expect(http.sentence).toContain("servidor MCP remoto em api.githubcopilot.com");
    expect(http.sentence).toContain("nenhum processo é iniciado");
  });
});

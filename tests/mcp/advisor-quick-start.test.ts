import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { Invalidation } from "../../src/server/connections/invalidation.js";
import { McpRegistry } from "../../src/server/mcp/registry.js";
import { descriptor } from "../../src/server/mcp/tool-policy.js";
import { advisorListArguments } from "../../src/shared/advisor-quick-start.js";
import type { ConfigSnapshot } from "../../src/shared/connections.js";

const accessId = randomUUID();
const subscription = randomUUID();
const name = "advisor_recommendation_list";
const inputSchema = {
  type: "object",
  properties: { subscription: { type: "string" } },
  required: ["subscription"],
};

function fixture() {
  const snapshot: ConfigSnapshot = {
    schemaVersion: 1,
    agentProfiles: [],
    mcpProfiles: [],
    accessProfiles: [
      {
        id: accessId,
        name: "Aplicação de teste",
        tenantId: randomUUID(),
        clientId: randomUUID(),
        preferredMode: "application",
        credentialVersion: 1,
        configurationVersion: 1,
        secretRef: "fixture",
      },
    ],
  };
  let tail = Promise.resolve();
  const store = {
    read: async () => structuredClone(snapshot),
    mutate: (change: (state: ConfigSnapshot) => void | Promise<void>) => {
      const action = tail.then(() => change(snapshot));
      tail = action.catch(() => {});
      return action;
    },
  } as any;
  const registry = new McpRegistry(
    store,
    {} as any,
    {} as any,
    new Invalidation(store),
    {} as any,
  );
  return { registry, snapshot };
}

it("reuses a prepared connection for the same saved access and subscription", async () => {
  const { registry, snapshot } = fixture();
  const [first, second] = await Promise.all([
    registry.prepareAdvisor(accessId, subscription),
    registry.prepareAdvisor(accessId, subscription),
  ]);
  expect(first.id).toBe(second.id);
  expect(snapshot.mcpProfiles).toHaveLength(1);
  await expect(
    registry.prepareAdvisor(randomUUID(), subscription),
  ).rejects.toMatchObject({ code: "auth_configuration" });
});

it("binds guided approval to the reviewed schema and retains other approvals", async () => {
  const { registry, snapshot } = fixture();
  const { id } = await registry.prepareAdvisor(accessId, subscription);
  const existing = { name: "advisor_metadata_get", schemaHash: "existing" };
  snapshot.mcpProfiles[0].approvedTools.push(existing);
  const tool = descriptor({ name, inputSchema });
  const ctx = { requestId: "fixture" } as any;
  const callTool = vi.fn();
  vi.spyOn(registry, "connect").mockResolvedValue({
    profile: await registry.get(id),
    tools: [tool],
    client: {
      callTool,
      listTools: async () => ({
        tools: [
          { name, inputSchema: { ...inputSchema, description: "changed" } },
        ],
      }),
    },
  } as any);

  await expect(
    registry.approve(ctx, id, [name], "a".repeat(64)),
  ).rejects.toMatchObject({ code: "configuration_changed" });
  expect((await registry.get(id)).approvedTools).toEqual([existing]);
  await registry.approve(ctx, id, [name], tool.schemaHash);
  expect((await registry.get(id)).approvedTools).toEqual([
    existing,
    { name, schemaHash: tool.schemaHash },
  ]);
  await expect(
    registry.call(
      ctx,
      id,
      name,
      { subscription },
      undefined,
      true,
      tool.schemaHash,
    ),
  ).rejects.toMatchObject({ code: "configuration_changed" });
  expect(callTool).not.toHaveBeenCalled();
});

it("requires an explicit subscription and declines an incompatible schema", () => {
  expect(
    advisorListArguments(descriptor({ name, inputSchema }), subscription),
  ).toEqual({ subscription });
  expect(
    advisorListArguments(
      descriptor({
        name,
        inputSchema: {
          ...inputSchema,
          required: ["subscription", "resource-group"],
        },
      }),
      subscription,
    ),
  ).toBeUndefined();
  expect(
    advisorListArguments(
      descriptor({ name, inputSchema, annotations: { destructiveHint: true } }),
      subscription,
    ),
  ).toBeUndefined();
});

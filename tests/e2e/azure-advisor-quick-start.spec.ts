import { test, expect } from "./fixtures.js";

const accessId = "11111111-1111-4111-8111-111111111111";
const connectionId = "22222222-2222-4222-8222-222222222222";
const subscription = "33333333-3333-4333-8333-333333333333";
const schemaHash = "a".repeat(64);
const name = "advisor_recommendation_list";

for (const reviewable of [true, false]) {
  test(`Advisor ${reviewable ? "requires explicit approval and keeps its scope on return" : "offers the inspector when policy blocks the tool"}`, async ({
    page,
  }) => {
    const operations: { path: string; body: unknown }[] = [];
    let active = false;
    let approved = false;
    const connection = {
      id: connectionId,
      accessId,
      name: "Azure Advisor",
      preset: "azure",
      transport: "stdio",
      authMode: "application",
      resourceContext: { namespace: "advisor", subscription },
    };
    const tool = {
      name,
      schemaHash,
      reviewable,
      approved: false,
      inputSchema: {
        type: "object",
        required: ["request"],
        properties: {
          request: {
            type: "object",
            required: ["subscription"],
            properties: { subscription: { type: "string" } },
          },
        },
      },
    };
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            sessionStorage.setItem("fixture-clipboard", text);
          },
        },
      });
    });
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      let json: unknown = [];
      if (
        request.method() === "POST" &&
        (path.startsWith("/api/mcp-connections/") || path.endsWith("/connect"))
      ) {
        operations.push({ path, body: request.postDataJSON() });
      }
      if (path === `/api/accesses/${accessId}/connect`) {
        active = true;
        json = { connected: true };
      }
      if (path === "/api/bootstrap")
        json = {
          csrf: "test",
          authenticated: active,
          ...(active
            ? { activeAccessId: accessId, principalKind: "application" }
            : {}),
          configured: false,
          period: {
            from: "2026-10-01",
            toExclusive: "2026-11-01",
            timeZone: "America/Sao_Paulo",
          },
        };
      if (path === "/api/accesses")
        json = [
          { id: accessId, name: "Acesso de teste", secretConfigured: true },
        ];
      if (path === "/api/mcp-connections")
        json = operations.some((event) => event.path.endsWith("/azure-advisor"))
          ? [connection]
          : [];
      if (path === "/api/subscriptions")
        json = [{ id: subscription, name: "Assinatura de exemplo" }];
      if (path.endsWith("/azure-advisor")) json = connection;
      if (path.endsWith("/test")) json = { connected: true, tools: [tool] };
      if (path.endsWith("/catalog"))
        json = {
          server: { name: "Azure MCP", version: "3.0.0" },
          tools: [{ ...tool, approved }],
        };
      if (path.endsWith("/approve-tools")) {
        approved = true;
        json = connection;
      }
      if (path.endsWith("/call"))
        json = {
          requestId: "fixture-op",
          result: {
            structuredContent: {
              results: {
                recommendations: [
                  {
                    properties: {
                      impactedValue: "vm-exemplo",
                      category: "OperationalExcellence",
                      impact: "Medium",
                      shortDescription: {
                        solution:
                          "Add explicit outbound method to disable default outbound for Virtual Machine Scale Sets",
                      },
                    },
                  },
                ],
              },
            },
          },
        };
      await route.fulfill({ json });
    });

    await page.goto("/conexoes/integracao");
    await page.getByRole("button", { name: "Usar acesso salvo" }).click();
    await page
      .getByRole("combobox", { name: "Acesso de aplicação", exact: true })
      .selectOption(accessId);
    if (reviewable) {
      await page
        .getByRole("button", { name: "Buscar assinaturas", exact: true })
        .click();
      await page.getByLabel("Buscar por nome ou ID").fill("exemplo");
      await page.getByRole("button", { name: /Assinatura de exemplo/ }).click();
    } else
      await page
        .getByLabel("Assinatura Azure", { exact: true })
        .fill(subscription);
    await page.getByRole("button", { name: "Conectar e testar" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "1 ferramenta encontrada" }),
    ).toBeVisible();
    expect(operations).toEqual([
      {
        path: `/api/accesses/${accessId}/connect`,
        body: { mode: "application" },
      },
      {
        path: "/api/mcp-connections/azure-advisor",
        body: { accessId, subscription },
      },
      { path: `/api/mcp-connections/${connectionId}/test`, body: {} },
    ]);

    const query = page.getByRole("button", {
      name: "Autorizar e consultar recomendações",
    });
    if (reviewable) {
      await query.click();
      await expect(
        page.getByText("Consulta de recomendações concluída."),
      ).toBeVisible();
      await expect(
        page.getByText(/Configure um método explícito de saída/),
      ).toBeVisible();
      expect(operations.slice(3)).toEqual([
        {
          path: `/api/mcp-connections/${connectionId}/approve-tools`,
          body: { names: [name], advisorSchemaHash: schemaHash },
        },
        {
          path: `/api/mcp-connections/${connectionId}/call`,
          body: {
            name,
            arguments: { request: { subscription } },
            expectedSchemaHash: schemaHash,
            confirmedExecution: true,
          },
        },
      ]);
      await page.getByRole("button", { name: "Copiar resultado" }).click();
      await expect(page.getByText("Resultado copiado.")).toBeVisible();
      expect(
        await page.evaluate(() =>
          JSON.parse(sessionStorage.getItem("fixture-clipboard") || "{}"),
        ),
      ).toMatchObject({ requestId: "fixture-op" });
    } else {
      await expect(query).toHaveCount(0);
      expect(operations).toHaveLength(3);
    }
    await page
      .getByRole("button", { name: "Abrir Inspetor do Azure Advisor" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/conexoes/inspetor/${connectionId}$`),
    );
    await expect(
      page.getByRole("navigation", { name: "Caminho de navegação" }),
    ).toContainText("Azure Advisor");
    await expect(
      page.getByRole("heading", { name: "Mapa de conexões" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Descobrir capacidades MCP" })
      .click();
    await expect(
      page.getByText(
        reviewable ? "Aprovada nesta conexão" : "Bloqueada pela política",
        { exact: true },
      ),
    ).toBeVisible();
    if (reviewable) {
      await page.getByRole("button", { name: "Abrir execução" }).click();
      await expect(
        page.getByRole("heading", { name: "Executar uma consulta" }),
      ).toBeVisible();
    } else
      await expect(
        page.getByRole("button", { name: "Revisar permissão" }),
      ).toHaveCount(0);
    await page.reload();
    await page
      .getByRole("button", { name: "Voltar à consulta do Azure Advisor" })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/conexoes/integracao/${connectionId}$`),
    );
    await expect(
      page.getByLabel("Assinatura Azure", { exact: true }),
    ).toHaveValue(subscription);
    await expect(
      page.getByRole("combobox", { name: "Acesso de aplicação", exact: true }),
    ).toHaveValue(accessId);
    const map = page.getByRole("region", { name: "Visão da integração" });
    await map.getByRole("button", { name: /Azure Resource Graph/ }).click();
    await expect(map.getByText(/tabela advisorresources/)).toBeVisible();
  });
}

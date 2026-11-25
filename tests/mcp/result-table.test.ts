import { describe, expect, it } from "vitest";
import { resultObject, resultTable, tableCsv } from "../../src/shared/result-table.js";
import { safeToolResult } from "../../src/server/mcp/tool-policy.js";
import { expectedAzureTools, parseNamespaces } from "../../src/shared/mcp-catalog.js";
import { copilotConfig } from "../../src/web/integrations/CopilotExport.js";

// Formato real de pricing_get (azmcp 3.0.0), campos como no retorno observado em 25/11/2026.
const price = (i: number) => ({
  armSkuName: "Standard_D4s_v5",
  skuName: i % 2 ? "Standard_D4s_v5 Spot" : "Standard_D4s_v5",
  productName: "Virtual Machines Dsv5 Series Windows",
  serviceName: "Virtual Machines",
  serviceFamily: "Compute",
  region: i === 0 ? "brazilsouth" : `region${i}`,
  location: i === 0 ? "BR South" : `R ${i}`,
  retailPrice: i === 0 ? 2.6342 : 1 + i / 1000,
  unitPrice: 1,
  currencyCode: "BRL",
  unitOfMeasure: "1 Hour",
  priceType: "Consumption",
  effectiveStartDate: "2021-11-01T00:00:00+00:00",
  meterName: "D4s v5",
  meterId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
  isPrimaryMeterRegion: true,
});
const toolResult = (n: number) => ({
  _meta: { MicrosoftMcpToolId: "c5a8f7d2-9e3b-4a1c-8d6f-2b5e9c4a7d3e" },
  content: [{ type: "text", text: JSON.stringify({ status: 200, message: "Success", results: { prices: Array.from({ length: n }, (_, i) => price(i)) } }) }],
});

describe("visão amigável de resultados MCP", () => {
  it("encontra a lista de preços e suas colunas", () => {
    const t = resultTable(toolResult(3))!;
    expect(t.path).toBe("results.prices");
    expect(t.total).toBe(3);
    expect(t.columns).toEqual(expect.arrayContaining(["armSkuName", "region", "retailPrice", "currencyCode"]));
    expect(t.rows[0].retailPrice).toBe(2.6342);
    expect(t.truncated).toBe(false);
  });

  it("acima de 128 kB, o servidor mantém registros parseados além do texto cortado", () => {
    const r: any = safeToolResult(toolResult(800));
    expect(r.partial).toBe(true);
    expect(() => JSON.parse(r.text)).toThrow();
    expect(r.table.total).toBe(800);
    expect(r.table.rows.length).toBeGreaterThan(300);
    expect(JSON.stringify(r).length).toBeLessThan(210_000);
    expect(r.table.truncated).toBe(r.table.rows.length < 800);
  });

  it("CSV usa ponto e vírgula e vírgula decimal (Excel pt-BR)", () => {
    const csv = tableCsv(resultTable(toolResult(1))!);
    expect(csv.split("\n")[1]).toContain("2,6342");
    expect(csv.split("\n")[0].split(";")).toContain("retailPrice");
  });

  it("retorno sem lista vira campos simples", () => {
    const o = resultObject({ content: [{ type: "text", text: JSON.stringify({ status: 200, results: { name: "x", total: 3 } }) }] })!;
    expect(o.fields).toEqual([["name", "x"], ["total", 3]]);
  });
});

describe("vários grupos de tools do Azure na mesma conexão", () => {
  it("lê a lista e soma as tools medidas por versão", () => {
    expect(parseNamespaces(undefined)).toEqual(["pricing"]);
    expect(parseNamespaces("pricing, advisor,pricing")).toEqual(["pricing", "advisor"]);
    expect(expectedAzureTools(["pricing", "advisor", "monitor"], "3.0.0")).toBe(20);
    expect(expectedAzureTools(["pricing", "advisor", "monitor"], "4.0.0-beta.10")).toBe(31);
  });

  it("exporta um --namespace por grupo", () => {
    const cfg = JSON.parse(copilotConfig({ id: "1", name: "azure-full", preset: "azure", transport: "stdio", authMode: "application", resourceContext: { namespace: "pricing,advisor" } } as any));
    const args: string[] = cfg.servers["azure-full"].args;
    expect(args.filter((a) => a === "--namespace")).toHaveLength(2);
    expect(args).toEqual(expect.arrayContaining(["pricing", "advisor", "--read-only"]));
  });
});

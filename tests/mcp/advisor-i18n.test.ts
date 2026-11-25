import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { paramDescriptionPt, preferredLanguage, toolDescriptionPt } from "../../src/shared/tool-i18n.js";
import { advisorTypeTexts, localizedSuggestion, recommendationTypeIds } from "../../src/shared/advisor-i18n.js";
import { mcpPresentation } from "../../src/shared/mcp-presentation.js";

// Nomes de tools e parâmetros anunciados por tools/list do azmcp 3.0.0 e 4.0.0-beta.10 (namespace advisor).
const schemas: Record<string, Record<string, string[]>> = JSON.parse(
  readFileSync(new URL("../fixtures/azmcp-advisor-params.json", import.meta.url), "utf8"),
);

describe("textos em português das tools do Advisor", () => {
  for (const [version, tools] of Object.entries(schemas))
    it(`cobre todas as tools e parâmetros da versão ${version}`, () => {
      const missing: string[] = [];
      for (const [tool, params] of Object.entries(tools)) {
        if (!toolDescriptionPt(tool)) missing.push(tool);
        for (const p of params) if (!paramDescriptionPt(tool, p)) missing.push(`${tool}:${p}`);
      }
      expect(missing).toEqual([]);
    });

  it("não traduz parâmetros de outros servidores", () => {
    expect(paramDescriptionPt("query_logs", "tenant")).toBeUndefined();
  });

  it("pede pt-BR só quando o catálogo anuncia o idioma", () => {
    expect(preferredLanguage({ description: "Supported catalog languages are en, pt-BR, pt-PT" })).toBe("pt-BR");
    expect(preferredLanguage({ description: "Programming language filter" })).toBeUndefined();
  });
});

describe("tradução das recomendações pelo catálogo pt-BR", () => {
  const typeId = "3c510b6b-1d30-4f15-9d1b-1d4c7c4f5e2a";
  const recommendations = {
    results: {
      recommendations: [
        {
          name: "rec-1",
          properties: {
            recommendationTypeId: typeId.toUpperCase(),
            impactedValue: "netscaler-vpx-ha-1",
            category: "HighAvailability",
            impact: "High",
            shortDescription: { problem: "Upgrade to a newer SKU of Virtual Machine image", solution: "Upgrade to a newer SKU of Virtual Machine image" },
          },
        },
      ],
    },
  };
  const catalog = {
    results: [
      {
        id: "/providers/Microsoft.Advisor/metadata/x",
        properties: {
          recommendationTypeId: typeId,
          displayName: "Atualizar para um SKU mais recente da imagem da máquina virtual",
          shortDescription: { problem: "Imagem com SKU antigo", solution: "Atualize para um SKU mais recente da imagem da máquina virtual" },
        },
      },
    ],
  };

  it("liga recomendação e catálogo pelo recommendationTypeId", () => {
    const payload = [{ type: "text", text: JSON.stringify(recommendations) }];
    const ids = recommendationTypeIds([recommendations]);
    expect(ids).toEqual([typeId]);
    const texts = advisorTypeTexts([catalog]);
    const types = Object.fromEntries([...texts]);
    const item = mcpPresentation({ content: payload })!.items[0];
    expect(localizedSuggestion(types, item.typeId)).toBe("Atualize para um SKU mais recente da imagem da máquina virtual");
  });

  it("sem tradução, devolve indefinido para manter o texto original", () => {
    expect(localizedSuggestion({}, typeId)).toBeUndefined();
    expect(localizedSuggestion(undefined, undefined)).toBeUndefined();
  });
});

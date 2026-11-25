/**
 * Dicas por tool: finalidade em português e exemplos de pergunta.
 * Fonte: documentação "Azure MCP Server tools for Azure Advisor"
 * (learn.microsoft.com/azure/developer/azure-mcp-server/tools/azure-advisor).
 */
export type ToolHint = { purpose: string; examples: string[]; since?: string };

export const toolHints: Record<string, ToolHint> = {
  advisor_insight_list: {
    purpose: "KPIs agregados do Advisor: recursos ociosos, economia potencial, resiliência zonal e exposição a aposentadorias de serviço.",
    since: "4.0.0-beta",
    examples: [
      "Liste os insights do Advisor em todos os service groups e assinaturas acessíveis do tenant.",
      "Mostre a contagem de recursos ociosos e a economia potencial em USD do service group 'commerce'.",
      "Mostre o percentual de cobertura de resiliência zonal do service group 'commerce'.",
      "Traga o insight de aposentadoria de serviços da assinatura: exposição do dia 1, exposição atual e redução percentual.",
    ],
  },
  advisor_metadata_get: {
    purpose: "Detalhes de um tipo de recomendação: impacto, descrição, benefícios e documentação.",
    examples: ["Explique o tipo de recomendação 'Right-size or shutdown underutilized virtual machines'."],
  },
  advisor_metadata_list: {
    purpose: "Catálogo completo de tipos de recomendação do Advisor.",
    examples: ["Liste os tipos de recomendação de custo que o Advisor conhece."],
  },
  advisor_recommendation_list: {
    purpose: "Recomendações individuais e os recursos afetados.",
    examples: ["Liste as recomendações de custo da assinatura com o recurso afetado e a economia anual."],
  },
  advisor_recommendation_summary: {
    purpose: "Resumos, contagens, distribuições e priorização — responde 'onde focar primeiro?'.",
    examples: ["Quais são as recomendações mais críticas e onde devo focar primeiro?", "Resuma as recomendações por categoria e impacto."],
  },
  advisor_recommendation_prevalidate: {
    purpose: "Verifica se recursos ociosos podem ser removidos com segurança. Só analisa; nunca remove.",
    since: "4.0.0-beta",
    examples: ["Pré-valide se os discos ociosos recomendados podem ser removidos com segurança."],
  },
  advisor_recommendation_update: {
    purpose: "Altera o estado da recomendação (concluída, adiada, descartada, nova). Escrita: bloqueada no Tesseract.",
    examples: [],
  },
  advisor_remediation_get: {
    purpose: "Instruções e artefatos de correção (CLI, PowerShell, Bicep, Terraform).",
    examples: ["Traga o passo a passo e o script Bicep para corrigir esta recomendação."],
  },
  advisor_servicegroupintelligence_get: {
    purpose: "Saúde e criticidade de service groups (On Track, Attention Needed, At Risk, Critical).",
    since: "4.0.0-beta",
    examples: ["Qual o status dos service groups do tenant e quais estão At Risk ou Critical?"],
  },
};

export function toolHint(name: string) {
  return toolHints[name.replace(/^azmcp_/, "")];
}

/** Anotações MCP traduzidas para a interface. */
export const annotationLabels: { key: string; label: string; good: boolean; help: string }[] = [
  { key: "readOnlyHint", label: "Somente leitura", good: true, help: "Apenas lê; não altera nada." },
  { key: "destructiveHint", label: "Destrutiva", good: false, help: "Pode alterar estado ou recursos." },
  { key: "idempotentHint", label: "Idempotente", good: true, help: "Repetir produz o mesmo resultado." },
  { key: "openWorldHint", label: "Mundo aberto", good: false, help: "Depende de informação externa não controlada pela tool." },
  { key: "secretHint", label: "Segredo", good: false, help: "Manipula ou expõe segredos/credenciais." },
  { key: "localRequiredHint", label: "Local", good: true, help: "Opera somente em recursos locais." },
];

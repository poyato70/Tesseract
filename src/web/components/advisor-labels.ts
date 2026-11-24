const descriptions: Record<string, [string, string]> = {
  advisor_recommendation_list: [
    "Listar recomendações",
    "Consulta recomendações da assinatura e mostra os recursos afetados.",
  ],
  advisor_recommendation_summary: [
    "Resumir recomendações",
    "Agrupa as recomendações e calcula totais no Azure.",
  ],
  advisor_metadata_get: [
    "Consultar um tipo de recomendação",
    "Mostra a descrição e os detalhes de um tipo de recomendação.",
  ],
  advisor_metadata_list: [
    "Listar tipos de recomendação",
    "Consulta o catálogo do Azure Advisor. Pode incluir tipos sem recomendações ativas na assinatura.",
  ],
  advisor_remediation_get: [
    "Consultar instruções de correção",
    "Mostra orientações de correção para um tipo de recomendação.",
  ],
};

export function advisorToolLabel(name: string) {
  const key = name.replace(/^azmcp_/, "");
  return Object.hasOwn(descriptions, key) ? descriptions[key] : undefined;
}

export function advisorSuggestionPt(original?: string) {
  if (
    original?.trim().replace(/\.$/, "").toLowerCase() ===
    "add explicit outbound method to disable default outbound for virtual machine scale sets"
  )
    return "Configure um método explícito de saída para desativar o acesso de saída padrão nos conjuntos de dimensionamento de máquinas virtuais.";
}

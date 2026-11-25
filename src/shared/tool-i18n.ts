/**
 * Textos em português das tools do Azure Advisor (Azure MCP Server).
 * Fonte: inputSchema e description anunciados pelo azmcp 3.0.0 e 4.0.0-beta.10
 * (tools/list, namespace advisor). O texto original em inglês continua disponível
 * na interface; estes textos são a tradução do que o servidor anuncia.
 */

const strip = (name: string) => name.replace(/^azmcp_/, "");

/** Descrição completa de uso, traduzida, por tool. */
export const toolDescriptionsPt: Record<string, string> = {
  advisor_insight_list:
    "Mostra KPIs pré-agregados do Azure Advisor para um service group, uma assinatura ou todos os acessíveis: quantidade de recursos ociosos e economia potencial em USD, cobertura de resiliência zonal e exposição a aposentadorias de serviço (linha de base do dia 1, exposição atual e percentual de redução). Filtre por --insight-name (IdleResources, ZonalResiliency, ServiceRetirement) e limite com --top (padrão 50, máx. 500). Retorna KPIs agregados, não listas de recursos: para recomendações individuais use recommendation list; para contagens e rankings, recommendation summary.",
  advisor_metadata_get:
    "Explica um tipo de recomendação do Advisor a partir do seu ID: nome, categoria, subcategoria, impacto, tipo de recurso suportado, descrição, benefícios e link de documentação.",
  advisor_metadata_list:
    "Lista o catálogo global de tipos de recomendação do Advisor. Serve para descobrir o que o Advisor pode recomendar antes de implantar recursos (mesmo sem recomendações ativas), filtrar por tipo de recurso e consultar aposentadorias de serviço por tracking ID do Service Health (ex.: QNY1-HB8) ou por data. Filtros opcionais: idioma, tipo de recurso, impacto, categoria, subcategoria, tracking ID e data de aposentadoria. Retorna IDs de tipo, nomes, categorias, impacto, prioridade, descrições, benefícios e ações localizados, ordenados por impacto (Alto → Médio → Baixo). Para recomendações atuais e recursos afetados use recommendation list.",
  advisor_recommendation_list:
    "Lista, mostra ou busca recomendações individuais do Advisor e os recursos afetados em uma assinatura ou service group. Com --category Cost --sub-category IdleResources mostra recursos sem uso e a economia estimada. Filtros: categoria, subcategoria, impacto, status (New, Postponed, Dismissed, Completed), ID do tipo, recurso, tipo de recurso, texto livre, tracking ID, data de aposentadoria, família de produto e economia anual mínima. Retorna instâncias de recomendação (não o catálogo). Para pedidos amplos de prioridade (“o que corrigir primeiro”) use antes recommendation summary com --group-by recommendation-type --prioritized true; para um tipo específico, use esta tool com --recommendation-type-ids de um elemento e --prioritized true. Não some resultados desta lista: ela é limitada (padrão 50, máx. 100); para contagens use summary.",
  advisor_recommendation_prevalidate:
    "Verifica, somente leitura, se os recursos afetados de um tipo de recomendação Cost/IdleResources passam na pré-validação para exclusão: detecção, idade mínima sem uso (30 dias por padrão), locks, riscos específicos do recurso e dependências visíveis. Retorna veredito por recurso (seguro, revisar, bloqueado), evidências, verificações manuais e economia de varejo em USD. Passar nas verificações não autoriza a exclusão. Nunca exclui recursos, executa scripts ou muda o estado da recomendação.",
  advisor_recommendation_summary:
    "Resume as recomendações com contagens, totais, rankings e distribuições calculados no servidor, para uma assinatura ou service group. É a tool para “quantas”, “distribuição”, “mais comuns”, “qual tem mais” e para “principais ações / o que corrigir primeiro” (com --prioritized true, que ordena os tipos por prioridade). Com --category Cost --sub-category IdleResources resume recursos ociosos, economia potencial, desperdício acumulado e economia realizada (estimativas de varejo do Advisor, não faturamento). Agrupa por recommendation-type, category (padrão), impact, resource-type, status, sub-category ou retirement-date. O total sempre cobre toda a população filtrada, mesmo quando --top limita os grupos exibidos.",
  advisor_recommendation_update:
    "Altera o estado de uma recomendação: concluída, descartada (com motivo), adiada até uma data futura ou reativada (New). Também aceita lote com --recommendation-ids. Não altera recursos, mas é uma escrita no Advisor — no Tesseract fica bloqueada.",
  advisor_remediation_get:
    "Traz o pacote de correção de um tipo de recomendação: passo a passo e artefatos prontos (ARM, Bicep, Azure CLI, PowerShell e Terraform), além de características da correção: se é destrutiva, reversível, confiança, esforço e tipo de saída.",
  advisor_servicegroupintelligence_get:
    "Mostra o status e a criticidade atuais dos service groups (On Track, Attention Needed, At Risk, Critical, Unavailable) e quais precisam de atenção. Filtre por --service-group (só o nome), --criticality (MissionCritical = Tier 0 … Administrative = Tier 3) e --status; limite com --top (padrão 50, máx. 500). Retorna nome, ID, criticidade, status, descrições de status e foco e a data de atualização.",
};

/** Parâmetros: texto padrão por nome. */
const paramsPt: Record<string, string> = {
  "as-of": "Para Cost/IdleResources: calcula a economia nesta data/hora UTC (ISO 8601, ex.: 2026-09-30T23:59:59Z). Assume status Completed se não informado. Valores históricos são estimativas do Advisor, não faturamento.",
  category: "Filtro exato de categoria: Cost, HighAvailability, Security, Performance ou OperationalExcellence. Não diferencia maiúsculas.",
  "continuation-token": "Token de continuação devolvido pela página anterior. Repita-o sem alterar, com o mesmo escopo, tenant, filtros, ordenação e tamanho de página. Omita na primeira página.",
  criticality: "Filtro por criticidade: MissionCritical (Tier 0), BusinessCritical (Tier 1), BusinessOperational (Tier 2), Administrative (Tier 3) ou NotApplicable. Também aceita Tier0–Tier3 e 0–3.",
  from: "Para resumos históricos de Cost/IdleResources: considera recomendações concluídas por exclusão a partir desta data/hora UTC. Exige categoria Cost e subcategoria IdleResources.",
  "group-by": "Campo de agrupamento: recommendation-type, category, impact, resource-type, status, sub-category ou retirement-date. Padrão: category (temas gerais). Use recommendation-type sem --prioritized para saber os tipos mais frequentes; com --prioritized true, omita este campo.",
  impact: "Filtro por impacto no negócio: High, Medium ou Low. Não diferencia maiúsculas; sem filtro, a ordem é Alto, Médio, Baixo.",
  "insight-name": "Filtro por insight: IdleResources, ZonalResiliency ou ServiceRetirement. Omita para trazer todos do escopo.",
  language: "Idioma dos textos do catálogo. Padrão do servidor: inglês (en). Aceita en, cs, de, es, fr, hu, id, it, ja, ko, nl, pl, pt-BR, pt-PT, ru, sv, tr, zh-Hans e zh-Hant. Use pt-BR para receber em português.",
  "minimum-savings": "Para Cost/IdleResources: só recomendações com economia potencial anual de varejo (diária × 12 × 30,4) de pelo menos este valor em USD. Sem preço não atende ao filtro; zero é válido.",
  "minimum-unused-days": "Idade mínima sem uso, em dias (1 a 365). Padrão 30. Atividade recente, sinais ausentes ou histórico insuficiente exigem revisão.",
  "postponed-until-date-time": "Data/hora até a qual a recomendação fica adiada, em ISO 8601 com fuso. Obrigatório quando o status for Postponed; precisa ser no futuro.",
  prioritized: "Ordena por prioridade. Use true para “principais”, “mais críticas”, “o que corrigir primeiro”; não use para perguntas de frequência (“quantas”, “mais comuns”). Padrão false.",
  "product-family": "Filtro exato (sem diferenciar maiúsculas) pela família de serviço Azure no catálogo da recomendação.",
  "recommendation-dismiss-reason": "Motivo do descarte: ExcessiveCostInvestmentRequired, ImplementationStepsAreUnclear, IncompatibleWithTheCurrentConfiguration, RiskIsAcceptable, TooComplexOrImpracticalToImplement, AnAlternativeSolutionIsAlreadyInPlace ou Other (padrão).",
  "recommendation-id": "ID estável da recomendação do Advisor a ser alterada.",
  "recommendation-ids": "IDs estáveis de várias recomendações alteradas juntas (mesmo escopo, tenant, status e data/motivo). Cada uma é atualizada separadamente; o lote não é atômico.",
  "recommendation-status": "Novo estado: New, Postponed, Dismissed ou Completed. New reativa uma recomendação adiada, descartada ou concluída.",
  "recommendation-type-id": "ID (GUID) do tipo de recomendação, no formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx. É a chave que liga recomendações individuais ao catálogo.",
  "recommendation-type-ids": "Um ou mais IDs (GUID) de tipo de recomendação, combinados com OU. Para um tipo só, passe uma lista com um elemento; --prioritized exige exatamente um.",
  resource: "Filtra pelo recurso afetado: nome ou ID ARM completo (busca parcial, sem diferenciar maiúsculas).",
  "resource-group": "Nome do resource group Azure.",
  "resource-type": "Filtro exato pelo tipo de recurso Azure afetado, ex.: Microsoft.Storage/storageAccounts ou microsoft.compute/virtualmachines. Não diferencia maiúsculas.",
  "resource-types": "Um ou mais tipos de recurso Azure afetados, combinados com OU. Para um tipo só, passe uma lista com um elemento.",
  resources: "IDs ARM completos dos recursos afetados selecionados. Reaproveite os IDs devolvidos por recommendation list. Omita para validar o tipo em todo o escopo.",
  "retirement-date": "Filtro por data de aposentadoria do serviço no formato <operador>:<aaaa-MM-dd>, ex.: ge:2026-03-31. Operadores: eq, lt, le, gt, ge. Vale só para a subcategoria ServiceUpgradeAndRetirement.",
  search: "Texto livre buscado no texto do problema da recomendação (trecho, sem diferenciar maiúsculas), ex.: encryption, right-size, Key Vault. Prefira um filtro estruturado quando existir.",
  "service-group": "Nome do service group (ex.: commerce). Use service group ou assinatura, não os dois; sem nenhum, vale a assinatura padrão configurada.",
  "show-prioritization-signals": "Inclui os sinais de priorização originais do Azure Resource Graph. Exige --prioritized true; não altera filtro nem ordem.",
  status: "Filtro por status: New, Postponed, Dismissed ou Completed. Padrão: New.",
  "sub-category": "Filtro exato por subcategoria, ex.: IdleResources, ServiceUpgradeAndRetirement, ZoneResiliency, RegionalResiliency, Reservations, SavingsPlan, ComputeOptimization. O catálogo pode ganhar novos valores.",
  subscription: "ID (GUID) ou nome da assinatura Azure. Se vazio, usa a assinatura padrão do perfil do Azure CLI ou AZURE_SUBSCRIPTION_ID.",
  subscriptions: "Um ou mais IDs ou nomes de assinatura. Para uma só, passe uma lista com um elemento. Não combine com service group; sem nenhum, vale a assinatura padrão configurada.",
  tenant: "ID (GUID) ou nome do tenant do Microsoft Entra ID.",
  to: "Para resumos históricos de Cost/IdleResources: considera recomendações concluídas por exclusão até esta data/hora UTC. Exige categoria Cost e subcategoria IdleResources.",
  top: "Quantidade máxima de itens retornados.",
  "tracking-id": "Filtro exato pelo tracking ID do Service Health, ex.: QNY1-HB8 (aposentadorias de serviço).",
  "tracking-ids": "Um ou mais tracking IDs do Service Health (ex.: QNY1-HB8 9G0V-_G8); retorna as recomendações que tenham qualquer um deles.",
};

/** Parâmetros cujo significado muda conforme a tool. */
const paramsByToolPt: Record<string, string> = {
  "advisor_insight_list:subscription": "ID ou nome da assinatura (só o insight de aposentadoria de serviço se aplica). Não combine com service group; não há assinatura padrão.",
  "advisor_insight_list:service-group": "Nome do service group (ex.: commerce), não o ID ARM. Omita service group e assinatura para trazer todos os acessíveis.",
  "advisor_insight_list:top": "Quantidade máxima de insights (1–500, padrão 50).",
  "advisor_servicegroupintelligence_get:top": "Quantidade máxima de service groups (1–500, padrão 50).",
  "advisor_servicegroupintelligence_get:service-group": "Nome do service group (ex.: commerce), não o ID ARM. Omita para trazer o status de todos.",
  "advisor_servicegroupintelligence_get:status": "Filtro por status: On Track (sem riscos relevantes), Attention Needed (problemas limitados), At Risk (riscos materiais), Critical (ação imediata) ou Unavailable (sem recomendações ativas).",
  "advisor_recommendation_list:top": "Máximo de recomendações individuais retornadas (padrão 50, limite 1–100). É um limite de resultado, não uma priorização.",
  "advisor_recommendation_summary:top": "Limite de exibição (1–100) de grupos retornados. Padrão 10 com --prioritized true. O total continua cobrindo toda a população filtrada.",
  "advisor_recommendation_summary:status": "Só para Cost/IdleResources: filtra por New, Postponed, Dismissed ou Completed. Sem valor, entradas históricas assumem Completed; os demais resumos usam New.",
  "advisor_recommendation_prevalidate:top": "Máximo opcional de recursos afetados a validar. Omita para validar todos; um limite explícito é informado como cobertura parcial.",
  "advisor_recommendation_prevalidate:recommendation-type-id": "ID (GUID) do tipo de recomendação escolhido entre as recomendações existentes. Só tipos Cost/IdleResources de exclusão suportam pré-validação.",
  "advisor_recommendation_list:prioritized": "Ordena os registros individuais (não grupos). Exige exatamente um --recommendation-type-ids. Tipos de custo ordenam por economia; os demais por criticidade. Padrão false. Para prioridade ampla, use antes o summary.",
  "advisor_recommendation_summary:prioritized": "Classifica os tipos de recomendação por prioridade em vez de contar registros. Use true para “principais ações”, “mais críticas”, “o que corrigir primeiro”; informe a quantidade em --top (padrão 10). Não use para “quantas” ou “mais comuns”.",
  "advisor_recommendation_update:subscription": "ID ou nome da assinatura da recomendação. Use assinatura ou service group, não os dois.",
  "advisor_recommendation_update:service-group": "Nome, ID ou ID ARM do service group que contém a recomendação. Use service group ou assinatura, não os dois.",
};

export function toolDescriptionPt(tool: string): string | undefined {
  return toolDescriptionsPt[strip(tool)];
}

export function paramDescriptionPt(tool: string | undefined, param: string): string | undefined {
  if (!tool) return undefined;
  const t = strip(tool);
  if (!t.startsWith("advisor_")) return undefined;
  return paramsByToolPt[`${t}:${param}`] ?? paramsPt[param];
}

/** Idioma pedido por padrão quando a tool aceita `language` e o catálogo tem português. */
export function preferredLanguage(field: { description?: string } | undefined): string | undefined {
  return field && /pt-br/i.test(field.description || "") ? "pt-BR" : undefined;
}

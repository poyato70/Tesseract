---
name: finops-recomendacoes
description: Prioriza recomendações de otimização de custo (Azure Advisor, AWS Cost Optimization Hub/Compute Optimizer, rightsizing Delfos) por economia, esforço e risco. Use quando perguntarem o que otimizar, onde economizar, rightsizing ou recomendações.
---

# Recomendações priorizadas

## Entradas
- Assinatura/conta e categoria (Cost por padrão).
- Ferramentas: `advisor_recommendation_list` (Azure MCP, grupo advisor), AWS Billing MCP (Cost Optimization Hub, Compute Optimizer), MCP Delfos `delfos-rightsizing` quando integrado.

## Passos
1. Liste recomendações de custo. Mantenha o identificador, recurso, impacto e economia anual estimada **como o provedor informou** (moeda e base).
2. Agrupe duplicadas (mesmo recurso e ação).
3. Classifique esforço: reserva/Savings Plan e desligamento de ocioso = baixo; rightsizing = médio; rearquitetura = alto.
4. Ordene por economia estimada; em empate, menor esforço primeiro.
5. Marque risco quando a ação afeta disponibilidade (rightsizing de produção, desligamento).

## Saída
Top 10: ação · recurso · economia anual estimada (fonte) · esforço · risco · próximo passo. Some economias apenas na mesma moeda e deixe claro que é estimativa do provedor.

## Limites
- Não recalcule economia sem série de uso e preço contratual; sem medição, não há otimização.
- Recomendação não é execução: o Tesseract só lê.

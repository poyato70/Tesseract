---
name: finops-showback
description: Produz showback (e base para chargeback) de custo de nuvem por time, squad, aplicação ou centro de custo a partir de tags e do FinOps Hub (FOCUS). Use quando pedirem custo por equipe, rateio, alocação ou showback/chargeback.
---

# Showback por responsável

## Entradas
- Período fechado (mês civil anterior por padrão, fim exclusivo, America/Sao_Paulo para exibição).
- Chave de alocação: tag (`squad`, `centro-custo`, `aplicacao`) ou coluna FOCUS (`x_CostCenter`, `Tags`).
- Ferramentas: `query_costs` (ARM MCP, agrupando por tag) ou consulta KQL no FinOps Hub (ADX); LDAP/AD interno, se disponível, para nome do time.

## Passos
1. Consulte custo amortizado agrupado pela chave. Use amortizado para refletir reservas/Savings Plans.
2. Separe **Sem tag** como linha própria; não distribua automaticamente.
3. Calcule participação de cada grupo no total da mesma moeda.
4. Compare com o período anterior equivalente: variação absoluta e %.
5. Liste os 5 recursos de maior custo sem tag, com resource group.

## Saída
Tabela por grupo: custo amortizado · % do total · variação · tendência. Destaque "Sem tag" e a cobertura de tags (% do custo com tag).

## Limites
- Showback informa; chargeback exige regra de rateio aprovada (registre como ADR).
- Custos compartilhados (rede, plataforma) só são rateados se houver regra explícita.

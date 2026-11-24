---
name: finops-budget
description: Avalia orçamentos de nuvem (Azure Budgets, AWS Budgets) contra o gasto atual e a previsão, e aponta quais estouram ou estão em risco. Use quando perguntarem sobre orçamento, budget, limite de gasto ou alerta de consumo.
---

# Budget — situação e risco

## Entradas
- Escopo (assinatura, resource group ou conta) e período do orçamento.
- Ferramentas aprovadas: `list_budgets`, `get_budget` (ARM MCP) ou a API Budgets do Tesseract; `forecast_costs` para projeção.

## Passos
1. Liste os orçamentos do escopo. Para cada um, leia `amount`, `timeGrain`, `currentSpend` e filtros.
2. Se `currentSpend` vier ausente, registre "indisponível"; não estime a partir de outra consulta.
3. Calcule `consumo = currentSpend / amount` (aritmética decimal, mesma moeda).
4. Obtenha a previsão do período com `forecast_costs` no mesmo escopo e filtros. Calcule `projeção = previsão / amount`.
5. Classifique: **Estourado** (consumo ≥ 100%), **Em risco** (projeção ≥ 100%), **Atenção** (projeção 80–99%), **Ok**.

## Saída
Tabela: orçamento · escopo · valor · gasto atual · % · previsão · % previsto · classificação · fonte. Depois, no máximo três ações com dono sugerido (ex.: revisar recomendações do Advisor do RG X).

## Limites
- Orçamento mede o próprio filtro; não compare com custo de outro escopo.
- Moedas diferentes ficam em linhas separadas.

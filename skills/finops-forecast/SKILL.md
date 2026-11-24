---
name: finops-forecast
description: Projeta o gasto de nuvem até o fim do mês, trimestre ou ano usando a previsão oficial do provedor e compara com orçamento e período anterior. Use quando perguntarem previsão, forecast, quanto vamos gastar ou tendência de custo.
---

# Forecast

## Entradas
- Escopo, horizonte (fim do mês por padrão) e base (real ou amortizada).
- Ferramentas: `forecast_costs` (ARM MCP) ou API Forecast do Tesseract; `query_costs` para o realizado; orçamento do escopo (skill finops-budget).

## Passos
1. Busque o realizado até ontem (fim exclusivo hoje) no escopo.
2. Busque a previsão oficial do restante do horizonte. Mantenha realizado e previsto separados.
3. Total projetado = realizado + previsto (mesma moeda e base).
4. Compare com o orçamento do período e com o mesmo período anterior.
5. Se a previsão não estiver disponível, diga isso; não extrapole linearmente sem avisar e sem pedir confirmação.

## Saída
Realizado · previsto · total projetado · intervalo de confiança (se o provedor fornecer) · orçamento · variação vs. período anterior · fonte e horário da consulta.

## Limites
- Previsão do provedor considera histórico; mudanças planejadas (migrações, novos ambientes) precisam ser informadas à parte (what-if).

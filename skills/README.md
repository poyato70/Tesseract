# Skills FinOps P0 (GitHub FinOps)

Skills no formato Agent Skills (`SKILL.md`) para agentes do Tesseract, GitHub Copilot e Codex. Ficam versionadas aqui como base do repositório "GitHub FinOps" (specs, skills, ADRs) e podem ser importadas em **Agentes e IA → Conhecimento e skills** pelo commit.

| Skill | Pergunta que responde | Fontes no Tesseract |
|---|---|---|
| `finops-budget` | Quais orçamentos estouram ou vão estourar? | ARM MCP `list_budgets`/`get_budget`, API Budgets |
| `finops-showback` | Quanto cada time/squad/centro de custo consumiu? | ARM MCP `query_costs` por tag, FinOps Hub (FOCUS) |
| `finops-recomendacoes` | O que otimizar primeiro e quanto economiza? | Advisor `advisor_recommendation_list`, AWS Cost Optimization Hub |
| `finops-forecast` | Quanto vamos gastar até o fim do mês/trimestre? | ARM MCP `forecast_costs`, API Forecast |

Regras comuns: não inventar números, declarar período (fim exclusivo), moeda, escopo, base (real/amortizada) e fonte; nunca somar moedas diferentes.

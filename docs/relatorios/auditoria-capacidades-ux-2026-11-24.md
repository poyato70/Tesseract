# Auditoria de capacidades e UX — Tesseract (24/11/2026)

Base: código da missão 22 (iteração 3), execução no navegador com servidor MCP de teste e conector AWS Pricing real via `uvx`, e as necessidades em `necessidades.txt`. Critérios: heurísticas de Nielsen (H1–H10), WCAG 2.2 AA, lei de Fitts. Severidade: **Crítica** (bloqueia uso corporativo), **Alta**, **Média**, **Baixa**.

## 1. Cobertura das necessidades

| Necessidade (notas) | Situação | Lacuna |
|---|---|---|
| MCPs Azure para FinOps, recomendações, observabilidade | Pronto: Advisor, Pricing, Quota, Monitor, Resource Health, Policy, Foundry, ARM Cost Management, FinOps Hub (ADX) | Sem leitura de emissões (GreenOps) |
| Microsoft Learn | Pronto (público) | — |
| Consumo de tokens de IA Azure | Parcial: página de uso de Azure OpenAI e grupo `foundry` | Sem visão consolidada tokens × custo por modelo/equipe |
| GitHub corporativo | Pronto: remoto (github.com/GHE.com) e GHES via Docker | Sem Copilot seats/usage metrics (custo de licença) |
| Copilot corporativo (chave impessoal) e local (chave do usuário) | Pronto: GitHub Models com `/orgs/ORG/inference`; Copilot local com runtime empacotado | Login do Copilot só pelo CLI |
| OpenShift (inclui cost management) | Parcial: leitura do cluster (kubeconfig ou HTTP); OpenCost na visão multicloud | Red Hat Cost Management não integrado |
| Db2, Hive/DataCloud, Teams, SMTP, LDAP/AD/Kerberos | Modelo apontando para servidor MCP interno | Nenhum servidor oficial existe; depende do time Delfos/plataforma |
| Power BI em linguagem natural | Pronto (preset Power BI) | Criação de dashboards não exposta (somente consulta) |
| Loader tesseract em toda execução | Pronto | — |
| Gráficos de tipo de conexão | Pronto ("Como funciona esta conexão") | — |
| Skills FinOps P0 | Pronto em `skills/` (budget, showback, recomendações, forecast) | Importação automática no agente padrão |

## 2. Achados de capacidade

| # | Sev. | Achado | Evidência | Recomendação |
|---|---|---|---|---|
| C1 | Crítica | Conectores MCP **remotos** não passam pelo proxy corporativo: o transporte usa DNS fixado (anti-SSRF). Na rede do banco, GitHub, Learn, BigQuery, ARM MCP e Fabric tendem a falhar. | `fetchBound` em `security/endpoint-policy.ts`; README já alerta | Suportar `HTTPS_PROXY` com CONNECT mantendo a checagem de destino (resolver o host no proxy e validar o nome contra o padrão oficial do conector). |
| C2 | Alta | Repositório sem CI: `.github/workflows/ci.yml` não foi gravado (caminho protegido). | Pasta ausente em `poyato70/Tesseract` | Copiar `ci.yml` da missão 21 e rodar `npm ci`, `typecheck`, `test`, `build` em `windows-latest`. |
| C3 | Alta | Specs Playwright ainda cobrem a interface antiga; não servem como aceite. | `tests/e2e/*.spec.ts` | Reescrever 5 jornadas: catálogo → criar → testar → executar → centro operacional. |
| C4 | Alta | Tools sem anotação `readOnlyHint` não podem ser aprovadas em GitHub, BigQuery e OpenShift, e a tela não diz por quê. | `reviewable()` em `tool-policy.ts` | Mostrar o motivo por tool ("servidor não declarou somente leitura") e permitir exceção nominal registrada em auditoria. |
| C5 | Alta | Token do BigQuery expira em ~1 h e não é renovado. | Preset `gcp-bigquery` com Bearer | Aceitar conta de serviço (JSON no cofre) e emitir token por OAuth JWT a cada conexão. |
| C6 | Média | Cofre só no Windows (DPAPI): impede hospedagem em Linux/contêiner. | `secret-store.ts` | Abstrair o cofre: DPAPI no Windows, Key Vault ou arquivo cifrado com chave do SO no Linux. |
| C7 | Média | Sem custo de licenças Copilot. | — | Conector REST para `/orgs/{org}/copilot/billing/seats` e métricas de uso (token `manage_billing:copilot`), mostrando custo por assento ativo/ocioso. |
| C8 | Média | GreenOps ausente. | — | Usar a exportação de emissões do Cost Management/Carbon Optimization ou a coluna de emissões do FinOps Hub. |
| C9 | Média | Notificações (Teams/SMTP) sem agendamento nem regra. | Apenas modelos de conector | Regras "budget > 80%" e "recomendação nova" com envio via MCP interno de Teams/SMTP. |
| C10 | Baixa | Execuções e eventos ficam só em memória da sessão. | Texto "Diagnóstico mantido em memória" | Persistir histórico resumido (sem argumentos) para tendência semanal. |

## 3. Achados de UX

| # | Sev. | Heurística | Achado | Recomendação |
|---|---|---|---|---|
| U1 | Alta | H1 Visibilidade | "Atividade · 15 min" conta o polling automático (GET a cada 15 s): as barras ficam sempre cheias e escondem a atividade real. | Contar só ações do usuário e execuções (`POST`/`call`); mostrar polling à parte ou omitir. |
| U2 | Média | H1 / H9 | O sino soma erros de validação (400) como falhas operacionais. | Separar "falhas de execução" de "dados inválidos"; o sino só para execuções/conexões. |
| U3 | Média | H2 Linguagem | "Desconectado" na barra superior não diz de quê. | "Azure: desconectado" com o nome da credencial; tooltip com o que depende dela. |
| U4 | Média | H8 Minimalismo | Catálogo muito longo (6 grupos + Registry + por provedor + manifesto). | Abas: "Conectores" / "MCP Registry" / "Avançado"; âncoras por grupo no topo. |
| U5 | Média | H4 Consistência | Restos do tema antigo: botão azul "Buscar servidores", selects de "Por provedor", formulários de Agentes e Chat. | Migrar para `lx-btn` e campos do tema v2. |
| U6 | Média | H6 Reconhecimento | Formulário de conector nativo mantém a coluna "3 · Escopo" vazia. | Duas colunas quando o conector não tem escopo; mostrar pré-requisito e documentação ali. |
| U7 | Média | Mobile | Diagrama pequeno em telas estreitas. | Layout vertical (coluna única) abaixo de 860 px. |
| U8 | Baixa | H5 Prevenção | Textarea de variáveis mostra o modelo como placeholder; dá para salvar achando que já está preenchido. | Botão "Inserir modelo" que copia o texto para edição. |
| U9 | Baixa | Estética | Legenda "Tokens e chaves" é cruzada por linha tracejada no centro operacional. | Desviar arestas da legenda (porta inferior + offset) ou legenda à direita na coluna de credenciais. |
| U10 | Baixa | H7 Eficiência | Testar não guarda argumentos usados. | Histórico de argumentos por tool (sem segredos) e "repetir última execução". |
| U11 | Baixa | WCAG 2.5.8 | Botões de zoom com 28 px (passa no mínimo de 24 px, mas ruim para toque). | 36 px em `pointer: coarse`. |

Pontos fortes confirmados: estados reais (nada inventado), passo a passo de cinco etapas claro, foco visível, `prefers-reduced-motion` respeitado, segredos nunca exibidos, recusa de endpoint fora do padrão antes de qualquer rede.

## 4. Plano de correção (para agente de codificação)

**P0 — antes de instalar no banco**
1. C1 proxy para MCP HTTP com validação de destino; teste com proxy local (`proxy-chain`) na suíte.
2. C2 CI em `windows-latest`.
3. U1 e U2: filtrar polling e 4xx de validação em `activityBuckets` e `recentFailures`.
4. C4 motivo de não-aprovação visível na aba Testar.

**P1 — próxima iteração**
5. C3 e2e das cinco jornadas.
6. C5 conta de serviço GCP.
7. C7 custo de licenças Copilot.
8. U3, U4, U5, U6.

**P2**
9. C6 cofre multiplataforma; C8 GreenOps; C9 alertas; C10 histórico; U7–U11.

Cada item deve vir com teste unitário e, quando visual, captura antes/depois em `docs/relatorios/evidencias/`.

## 5. Situação após a correção (24/11/2026, tarde)

| Item | Situação |
|---|---|
| C1 proxy para MCP HTTP | **Feito** — `proxyFor` + `ProxyAgent` (túnel CONNECT), `NO_PROXY`, loopback/privado direto, DNS local opcional atrás do proxy; teste com proxy real em `tests/security/proxy.test.ts`. |
| C2 CI | **Feito no push** — `publish-github.ps1` copia `ci.yml` da missão 21 quando ausente. |
| C3 e2e | **Feito** — `npm run test:e2e:m22`, 5 jornadas aprovadas. |
| C4 motivo de bloqueio | **Feito** — `reviewReason` exibido na aba Testar. |
| C5 conta de serviço GCP | **Feito** — JWT bearer (RFC 7523), token em cache e renovado. |
| C7 licenças Copilot | **Feito** — FinOps → Licenças Copilot. |
| U1, U2 | **Feito** — polling e erros de validação fora de Atividade, eventos recentes e sino. |
| U3 | **Feito** — "Azure · desconectado/credencial" com explicação. |
| U4 | **Feito** — abas no catálogo. |
| U5 | **Feito** — botões e cartões legados no tema v2. |
| U6, U8 | **Feito** — formulário em 2 colunas para conectores nativos; botão "Inserir modelo". |
| U7 | **Feito** — lista vertical abaixo de 760 px. |
| U10, U11 | **Feito** — últimos argumentos por tool (memória da aba); zoom com 40 px em toque. |
| C6, C8, C9, C10, U9 | Pendentes (P2). |

# Missão 22 — Rebuild da experiência de integrações

## Identificação

- **Estado atual:** Implementação e validação local concluídas em cópia isolada.
- **Início do registro:** 2026-11-24 04:59 -03:00.
- **Conclusão da validação:** 2026-11-24 05:25 -03:00.
- **Origem:** cópia de `D:/DEV/FinOps/Tesseract-missao-21` (não alterada).
- **Destino:** `D:/DEV/FinOps/Tesseract-missao-22-rebuild`, sem `.git`, `node_modules` nem artefatos de build.
- **Publicação:** Não executada.

## Diagnóstico (missão 21)

- A mesma tarefa tinha três portas de entrada: **MCPs → Integração** (mapa de provedores + demo de fluxo sequencial M12 + formulário + lista + jornada do Advisor), **MCPs → Descoberta** (Registry + catálogo de nuvem + Advisor de novo) e **MCPs → Análise** (Inspetor, onde de fato se testava).
- `McpConnections.tsx` (1.412 linhas) servia a dois modos opostos via `mode="integration" | "analysis"`; o usuário precisava saber que "testar" morava em "Análise".
- O mapa da integração era uma coluna estática; latência e estados não vinham de dados.
- Navegação misturava "APIs — capacidades" (laboratório de APIs de custo) dentro de Conexões e o experimento de observabilidade em Operação.

## O que mudou

| Área | Antes | Depois |
|---|---|---|
| Navegação | Workspace / Conexões / Agentes / Análises / Operação | **Início → Integrações → FinOps → Agentes e IA → Operação**, sidebar de vidro recolhível com "Próximo passo" |
| Onde integrar | Integração, Descoberta e Advisor separados | **Integrações → Catálogo** (cartões prontos, Registry, por provedor, manifesto) |
| Onde testar | MCPs → Análise (Inspetor) | **/integracoes/:id/testar** — 1 Conectar · 2 Aprovar · 3 Executar, na mesma página do mapa |
| Mapa | Coluna estática | **Mapa vivo** com etapas numeradas, fluxo animado, pacote em trânsito durante a execução, zoom/pan, painéis de tools e endpoints, ação por componente |
| Estado | Rótulos de texto | Anel de progresso de 5 etapas por integração (Configurar, Autenticar, Conectar, Aprovar, Executar) |
| Rotas | `/conexoes/integracao|inspetor|catalogo/:id` | `/integracoes`, `/integracoes/catalogo`, `/integracoes/:id[/testar|configuracao|atividade]`, `/finops/*`, `/ia/*`, `/operacao/*`; endereços antigos redirecionam |

Arquivos novos: `src/web/shell/{routes.ts,Sidebar.tsx,Overview.tsx}`, `src/web/integrations/{model.ts,LiveDiagram.tsx,IntegrationDetail.tsx,ToolTester.tsx,IntegrationForm.tsx,IntegrationsList.tsx,Catalog.tsx}`, `src/web/styles-rebuild.css`, `tests/rebuild-integrations.test.ts`. `App.tsx` reescrito.

Removidos (substituídos): `pages/McpConnections.tsx`, `pages/Discovery.tsx`, `pages/WorkspaceHome.tsx`, `components/{Navigation,Breadcrumbs,CommandHero,Welcome,ThemeControl,ConnectionsMap}.tsx`. O fluxo sequencial M12 saiu da interface; o serviço e seus testes continuam.

Mantidos sem alteração: todo o servidor (`src/server`), contratos (`src/shared`), páginas financeiras, Agentes, Chat, Hub, Acessos, Inspetor de capacidades (`McpLab`, agora em "Capacidades avançadas" da aba Testar) e a jornada guiada do Advisor (aberta pelo cartão do catálogo).

## Regras de dados do mapa vivo

- Nenhuma latência por componente é estimada. A duração exibida vem de `durationMs` retornado pela chamada ou do intervalo entre eventos do diagnóstico da mesma operação.
- "Última execução", linha do tempo e métricas usam apenas eventos `POST /api/mcp-connections/:id/call` e os eventos `MCP` com o mesmo `requestId`, retidos em memória na sessão.
- Contagem de itens só aparece quando o formato do resultado é reconhecido.
- "Executar agora" conecta se necessário, usa uma tool já aprovada (no Advisor, aprova `advisor_recommendation_list` pelo caminho validado com hash do schema) e, se a tool exigir confirmação por chamada, leva à aba Testar.

## Validação

| Procedimento | Resultado | Limites |
|---|---|---|
| `tsc --noEmit` | Aprovado | Linux, Node 22.23. |
| `vitest run` | 215 aprovados, 8 ignorados (71 arquivos) | Inclui 8 testes novos de rotas e do modelo do mapa. |
| `node scripts/build-web.mjs` + `tsc -p tsconfig.server.json` | Aprovado | Build Next estático. |
| Jornada real no navegador (Chrome headless) | Aprovado | Harness Linux sem DPAPI; servidor MCP HTTP da fixture M10: criar integração, conectar, listar 4 tools, aprovar `m10_read_status`, "Executar agora", mapa 5/5, linha do tempo, atividade, redirecionamento de `/conexoes/inspetor/:id`. Sem erros de console. |
| Playwright `tests/e2e` existentes | **Não executado** | As specs das missões 10–21 navegam pelos rótulos antigos ("Conexões > MCPs > Análise") e precisam ser reescritas para as rotas novas. |
| Windows, DPAPI, Azure real, Edge | Não executado | Revalidar `npm ci`, `npm run build`, Advisor real e login delegado ARM no ambiente corporativo. |

## Pendências

- Reescrever as specs Playwright para `/integracoes/*` e remover as que testam telas excluídas.
- Tema claro: o rebuild fixa o tema escuro; as páginas financeiras herdaram os tokens novos, mas merecem revisão visual tela a tela.
- Avaliar se a demo de fluxo sequencial M12 deve voltar como ferramenta de "Orquestração" própria.

## Iteração 2 — tema v2, navegação auto-escondida e centro operacional

- **Tema v2** (`src/web/styles-v2.css`): grafite neumórfico, vidro fosco nas barras e acento ciano; laranja reservado a execução em curso, verde-água a sucesso.
- **Navegação**: trilho de vidro só com ícones que expande ao passar o mouse ou receber foco (Esc fecha); botão para fixar aberto, lembrado no navegador; no celular, barra inferior com painel completo.
- **Barra superior**: pílula de vidro com caminho, busca rápida (Ctrl K) por páginas e integrações, sino com falhas dos últimos 15 min e atalho de credenciais.
- **Centro operacional** (Início): diagrama vivo da topologia real — sessão → Tesseract → credenciais → integrações MCP e APIs Azure nativas → destinos. Pulsos laranja = execução nos últimos 20 s; pulso na cor da conexão = atividade nos últimos 5 min; vermelho = falha recente; tracejado = credencial pendente. Passar o mouse destaca o caminho; clique abre detalhes e ações; duplo clique abre a integração.
- **Widgets**: atividade por minuto (15 min), taxa de sucesso das execuções de tools, interruptores que conectam/desconectam cada integração e eventos recentes — todos a partir do diagnóstico da sessão.
- **Motor único** (`src/web/flow/FlowCanvas.tsx`): o mapa de cada integração passou a usar o mesmo motor, com tools aprovadas como sub-nós e o retorno por baixo do fluxo. A animação de execução permanece visível por ~1,6 s; a duração exibida continua sendo a real.
- **Validação**: `tsc` aprovado; `vitest` 218 aprovados / 8 ignorados (3 testes novos da topologia); build Next aprovado; jornada real no Chrome com o servidor MCP da fixture M10, sem erros de console. Capturas em `evidencias/missao-22/v2-*`.

## Iteração 3 — integrações nativas, interface compacta e implantação

**Pedido:** integrações nativas com MCPs de nuvem pública e privada, GitHub e GitHub Copilot corporativos, bastando configurar acesso, token e URL; peças menores sem mudar a fonte; sem espaço vazio; conferir a documentação de implantação; publicar no GitHub.

### Integrações nativas
- `src/shared/mcp-catalog.ts`: fonte única do catálogo (servidor e interface). Cada conector declara transporte, endpoint oficial e padrão de URL aceito, modos de autenticação, variáveis aceitas, executor (`npx`, `uvx`, `docker`) e política de aprovação de tools.
- Novos conectores: GitHub remoto (`api.githubcopilot.com/mcp/` ou `copilot-api.SUB.ghe.com/mcp`), GitHub Enterprise Server (Docker, somente leitura), AWS Billing and Cost Management 0.0.46 e AWS Pricing 1.1.2 (uvx), Google BigQuery (remoto), OpenShift/Kubernetes local (`kubernetes-mcp-server@0.1.3 --read-only`), Microsoft Learn e AWS Knowledge (públicos).
- Azure MCP: grupos liberados ampliados para quota, monitor, applicationinsights, resourcehealth, workbooks, policy e foundry (sempre `--read-only`).
- Novo modo de autenticação `env`: texto `CHAVE=valor` guardado no cofre DPAPI; só as chaves declaradas pelo conector chegam ao processo.
- Processos locais recebem variáveis de proxy, certificado e espelho de pacotes (necessário em rede corporativa; validado no sandbox, onde o uvx falhava por CA desconhecida sem elas).
- Copilot: agentes aceitam GitHub Models (`models.github.ai/orgs/ORG/inference`, token `models:read`) como modelo corporativo; Copilot local segue no chat; cada integração exporta `.vscode/mcp.json` sem segredos.
- Sistemas sem MCP oficial (Hive/DataCloud, Db2, Teams, SMTP, LDAP) aparecem como modelos que apontam para servidor MCP interno — não há conector inventado.

### Interface
- FlowCanvas sem ampliação acima de 100% e centralizado; nós menores (tile 46, hub 62, card 232×54, chip 32), fontes mantidas; altura do diagrama igual ao conteúdo; destinos com legenda ao lado.
- Página da integração: cartões e "Como funciona esta conexão" na coluna do diagrama (sem faixa vazia); painel lateral fixo ao rolar.
- Loader tesseract (hipercubo 4D girando) na barra superior durante toda execução e nos botões de conectar/executar.
- Botões, trilho, barra superior e cartões mais compactos.

### Validação
- `tsc` (web e servidor) sem erros; Vitest: 68 arquivos, 228 testes aprovados (10 novos em `tests/mcp/native-catalog.test.ts`); build Next OK.
- Ponta a ponta no sandbox: AWS Pricing via `uvx` conectou e listou 9 tools; endpoint GitHub fora do padrão recusado antes de qualquer rede; servidor HTTP interno executado com sucesso.
- Não validado: GitHub, BigQuery, Learn e AWS Knowledge reais (rede do sandbox bloqueia), Docker/GHES, Windows/DPAPI.

### Documentação de implantação
- Erros encontrados e corrigidos: URL do repositório (`azure-cost-local` → `Tesseract`), Node "24 obrigatório" (o `engines` aceita 22.21+ e 24.6+), dependência de CDN Three.js (não existe mais), menção a "MCPs" (agora Integrações), e2e apresentado como aceite (os specs ainda são da interface antiga), ausência de pré-requisitos por conector (uv, Docker) e de variáveis de proxy.
- Novo guia: `docs/implantacao-outro-host.md`.

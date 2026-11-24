# Missão 21 — Jornada guiada Azure Advisor

## Identificação

- **Estado atual:** Implementação e validação local concluídas.
- **Início do registro:** 2026-11-24 02:41:41 -03:00.
- **Conclusão da validação:** 2026-11-24 02:51:31 -03:00.
- **Repositório:** poyato70/azure-cost-local.
- **Branch local:** codex/missao-21-azure-advisor.
- **Commit inicial:** 84aabe6cad60b874d24fa57c1d091e413636b7f1.
- **Publicação:** Não executada.

## Objetivo e escopo

Disponibilizar, no catálogo MCP existente, o Azure Advisor preparado para vincular um acesso salvo e consultar recomendações de uma assinatura. Exibir etapas distintas para ativação do acesso, descoberta, aprovação e consulta. Manter acesso ao Inspetor da mesma conexão, com a seleção preservada ao voltar. Consultas de leitura usam o pacote oficial fixado já configurado no preset do projeto.

## Plano e acompanhamento

| Etapa | Estado | Evidência |
|---|---|---|
| 1. Inspeção e contexto | Aprovado | Main remota confirmada. Worktree separada criada em D:/DEV/FinOps/Tesseract-missao-21. |
| 2. Implementação | Aprovado | Jornada do catálogo, vinculação do acesso, escopo, aprovação, resultado, cópia e link para o Inspetor. |
| 3. Validação e revisão | Aprovado | Build, typecheck, testes MCP focados, Playwright e diff. |

Progresso local de 3/3 etapas (100%). Tempo decorrido medido desde o início do registro: 00:09:50.

## Implementação

- O catálogo oferece o Advisor pronto para escolher uma credencial de aplicação salva e o ID da assinatura. Se esse acesso já estiver conectado, o usuário também pode buscar as assinaturas visíveis por ele.
- Ao testar, o fluxo ativa o acesso escolhido pela rota normal quando necessário, prepara ou reutiliza a conexão com o mesmo acesso e assinatura, e lista as tools. A listagem, por si só, demonstra comunicação com o MCP.
- A consulta guiada aceita advisor_recommendation_list ou o nome equivalente com prefixo azmcp_ quando a política permite e o schema aceita o escopo explícito. A autorização exige ação do operador e preserva outras aprovações. Antes da execução, o Registry verifica a assinatura, a política e o hash do schema em vigor.
- O resultado usa o renderizador MCP existente e permite copiar a resposta. O Inspetor tem URL por conexão. A vista focada abre apenas a conexão selecionada e o retorno ao catálogo restaura o acesso e o escopo. Uma tool ausente, bloqueada ou incompatível deixa o Inspetor disponível.
- O Registry oficial e as telas existentes continuam como base da descoberta e inspeção. Os projetos externos avaliados orientaram a interação e não foram instalados.

## Validação

| Comando/procedimento | Resultado | Evidência e limites |
|---|---|---|
| npm ci --no-audit --no-fund | Aprovado | 371 pacotes declarados. Sem alteração no lockfile. O npm avisou sobre a cobertura de scripts de instalação de esbuild e koffi. |
| npm run typecheck e npm run build | Aprovado | Compilações concluídas com Node 24.20.0 no Windows. |
| Vitest com advisor-quick-start, tool-policy e mission10-registry | Aprovado | 9 testes em 3 arquivos. Inclui reaproveitamento sob concorrência simulada no mesmo processo, preservação de aprovações e recusa antes da chamada quando o schema muda. O M10 usou servidor MCP SDK de teste local. |
| Playwright com azure-advisor-quick-start, mcp-usability e mcp-clarity | Aprovado | 6/6 no Edge. A jornada com respostas simuladas verificou ativação do acesso, descoberta, aprovação, consulta, cópia, URL, recarga no Inspetor e retorno com a seleção original. O cenário bloqueado não enviou chamada de execução. O ambiente de teste usou a porta 43835 e armazenamento temporário. |
| git diff --check | Aprovado | Conferência do diff local. |
| Consulta Azure Advisor real, ambiente corporativo e publicação remota | Não executado | Credenciais e serviços corporativos fora desta rodada. |

A primeira execução Playwright parou em um seletor de teste que buscava o texto do label de um select. O cenário foi corrigido para usar o papel e nome acessíveis do controle. A segunda execução confirmou os quatro testes. Depois de retirar o mapa geral da vista focada do Inspetor, a rodada final confirmou seis testes, incluindo regressões da navegação e do cadastro.

## Pendências

- A primeira consulta corporativa de `advisor_recommendation_list` foi demonstrada pelo operador na rodada abaixo. Revalidar a interface nova com a mesma operação real.
- Revisar advisor_recommendation_summary separadamente para o preset. O fluxo desta missão manteve a política existente.
- Avaliar correlação FinOps com custos, orçamentos, tags e recomendações após a primeira leitura real do Advisor. ARM MCP remoto depende das condições de acesso documentadas nos testes corporativos.

## Continuação — Teste corporativo e mapa de cada integração

O operador demonstrou uma consulta real `advisor_recommendation_list` na jornada guiada, com recomendações recebidas e sucesso correlacionável no Diagnóstico. A conexão observada anunciou cinco ferramentas na versão 3.0.0. A execução confirma a operação e o escopo utilizados naquele teste. Dados financeiros, identificadores e nomes corporativos foram omitidos.

Na versão `Azure.Mcp.Server-3.0.0`, a Microsoft registra seis operações do Advisor. Uma delas, `advisor_recommendation_update`, altera o estado de uma recomendação e fica fora do modo `--read-only` utilizado pelo Tesseract. A [documentação online](https://learn.microsoft.com/en-us/azure/developer/azure-mcp-server/tools/azure-advisor) também cobre operações que não constam do [registro de ferramentas da versão fixada](https://github.com/microsoft/mcp/blob/Azure.Mcp.Server-3.0.0/tools/Azure.Mcp.Tools.Advisor/src/AdvisorSetup.cs).

| Camada | Cadastro, execução e evidência |
|---|---|
| Acessos | `AccessService` mantém o perfil e a referência protegida ao segredo. A rota de conexão de acessos ativa a identidade na sessão. A interface mostra o nome do acesso e o estado que pode observar. |
| Descoberta | `RegistryDiscovery` pesquisa metadados públicos. O catálogo prepara configurações que passam pela revisão do operador. |
| Integração | `McpRegistry.save` grava preset, transporte, identidade vinculada e escopo. A integração individual tem URL própria e mapa navegável. |
| Inspetor | `McpRegistry.tools` e `catalog` expõem as capacidades anunciadas. `tool-policy` e a aprovação pelo hash do schema determinam a execução permitida. A primeira vista do Advisor mostra o estado e a próxima ação. |
| Resultado | `McpRegistry.call` valida política, escopo e schema antes da chamada. O Advisor em `STDIO` consulta o Azure Resource Graph por HTTPS. O resultado volta pelo MCP e é apresentado separadamente da resposta técnica. |
| Diagnóstico | A conclusão no mapa usa a rota de execução daquele ID de conexão e o evento MCP com o mesmo identificador de operação. Os eventos são retidos na sessão. O mapa não estima latência por componente, disponibilidade do Azure ou histórico diário. |

A documentação de conexão anterior usava “Conexões padrão de nuvem” para sugestões por provedor. Essa seção passa a ficar recolhida na Descoberta. A tarefa cotidiana de preparar, conectar ou retomar o Advisor começa em **MCPs → Integração**. URLs anteriores que identificam uma conexão ainda resolvem a jornada. Configuração técnica, payload e exportação continuam acessíveis sob demanda.

A consulta guiada do Advisor devolve instâncias com conteúdo do Azure. O MCP 3.0.0 fixa o enriquecimento dessas instâncias em inglês. A ferramenta de metadados aceita `language: pt-br`, que localiza a definição do tipo de recomendação quando disponível. A interface usa descrições locais para as ferramentas conhecidas e para o exemplo relatado, preservando o texto de origem. A tradução integral dependerá de um recurso autorizado e de cobertura verificada.

### Validação da continuação

- Concluídas 4/4 etapas locais: mapeamento, implementação, validação isolada e verificação do serviço local. Tempo entre a criação do componente do mapa e a verificação no Edge: 9 min 14 s.
- `npm run typecheck` e `npm run build` passaram. Playwright passou 8/8 em `azure-advisor-quick-start`, `mcp-usability`, `mcp-clarity` e `ux03-inspector`; a jornada simulada comprovou busca, seleção, mapa, clique no nó do Resource Graph, aprovação, retorno e apresentação do exemplo em português. A rodada inicial revelou uma regressão de exibição em cadastros antigos do Advisor sem assinatura vinculada; a vista compacta passou a exigir o escopo e a rodada final passou. `git diff --check` passou e as capturas versionadas regravadas pela suíte foram restauradas aos arquivos originais.
- A instância do checkout M21 foi reiniciada na porta 4317 para carregar os ativos com a política de scripts correspondente ao build. O health check passou. A rota `/conexoes/integracao` retornou HTTP 200 com a política esperada e abriu no Edge sem erros de página às 04:28:25 -03:00. A sessão e os diagnósticos em memória foram reiniciados. Não foi executada uma nova chamada corporativa nesta rodada.

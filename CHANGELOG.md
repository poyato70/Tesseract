# Changelog

## Missão 22 — rebuild da experiência (não publicado)

- Navegação reordenada: Início → Integrações → FinOps → Agentes e IA → Operação, em sidebar de vidro recolhível.
- Integrar e testar na mesma página: `/integracoes/:id` com Mapa vivo, Testar, Configuração e Atividade. Endereços `/conexoes/*` redirecionam.
- Catálogo único (serviços prontos, MCP Registry, por provedor e manifesto) substitui Integração/Descoberta/Análise.
- Iteração 3: catálogo nativo (Azure FinOps/observabilidade, GitHub e GitHub Enterprise, Copilot via GitHub Models e Copilot local, AWS Billing/Pricing, Google BigQuery, OpenShift, Microsoft Learn, AWS Knowledge, servidores internos Hive/Db2/Teams/SMTP/LDAP); modo de credencial por variáveis de ambiente para conectores locais; exportação `mcp.json` para o Copilot; "Como funciona esta conexão"; loader tesseract em toda execução; interface compacta; skills FinOps P0 em `skills/`; guia `docs/implantacao-outro-host.md`.
- Detalhes: `docs/relatorios/missao-22.md`.

## 2.1.0-rc.1 — candidato de avaliação, não release estável

- Adiciona identidade de versão compartilhada entre interface e endpoint de health, mantendo compatibilidade com o campo legado `app`.
- Prepara preflight Windows sanitizado para ambiente, conectividade, proxy/TLS, políticas e pré-requisitos nativos.
- Revisa instalação para respeitar lockfile e políticas locais, validar artefatos e não instalar MCPs automaticamente.
- Revisa inicialização e atualização para observar o proxy do Node quando configurado pelo ambiente, preservar processos alheios e reconstruir após fast-forward.
- Adiciona material de avaliação corporativa e procedimentos Windows.
- O advisory transitivo `GHSA-fc5q-39xc-vjpf` foi retirado pelo GitHub em 18/11/2026; auditorias npm local integral e de produção passaram sem vulnerabilidades reportadas. O candidato permanece RC, sem aprovação de release estável, enquanto CI remota, instalação corporativa, proxy e dependência da PR #16 aguardam validação/revisão.

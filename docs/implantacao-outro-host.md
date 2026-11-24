# Implantar o Tesseract em outro host (Windows)

Revisado em 24/11/2026 contra o código da missão 22 (scripts da raiz, `package.json`, `src/server`). Substitui os trechos divergentes de `migration-windows.md` e `setup.md`.

## 1. Pré-requisitos

| Item | Obrigatório | Observação |
|---|---|---|
| Windows 64 bits, PowerShell 5.1+ (`powershell.exe`) | Sim | O cofre de segredos usa DPAPI via PowerShell do Windows. Linux/macOS não salvam segredos. |
| Node.js 22.21+ (linha 22) ou 24.6+ (linha 24), npm 9+ | Sim | Faixa declarada em `package.json` → `engines`. |
| Git e GitHub CLI (`gh`) | Sim para clonar o repositório privado | `gh auth login` com acesso a `poyato70/Tesseract`. |
| Acesso ao registry npm (direto ou espelho corporativo) | Sim | `npm ci` na instalação; `npx` baixa `@azure/mcp@3.0.0`, `@microsoft/fabric-mcp@1.7.0` e `kubernetes-mcp-server@0.1.3` no primeiro teste desses conectores. |
| uv (`uvx` no PATH) | Só para AWS Billing / AWS Pricing | `winget install --id astral-sh.uv -e`. Baixa os pacotes do PyPI (ou do índice em `UV_INDEX_URL`). |
| Docker | Só para GitHub Enterprise Server (MCP local) | Usa a imagem oficial `ghcr.io/github/github-mcp-server`. |
| Login no Copilot | Só para "Copilot local" no chat | O Tesseract usa o runtime do Copilot empacotado no SDK (`@github/copilot-sdk-win32-x64`, instalado pelo `npm ci`). Faça login uma vez com o CLI (`npm install -g @github/copilot`, `copilot` → `/login`); o login fica em `%USERPROFILE%\.copilot`. `COPILOT_CLI_PATH` força outro executável. |

Azure CLI, Python, .NET e módulos PowerShell do Azure **não** são necessários.

## 2. Instalar

```powershell
New-Item -ItemType Directory -Path D:\DEV\FinOps -Force | Out-Null
Set-Location D:\DEV\FinOps
gh repo clone poyato70/Tesseract
Set-Location Tesseract
.\preflight.ps1 -Port 4317 -ExportReport
.\install.ps1 -Port 4317
.\start.ps1 -Port 4317 -StartupTimeoutSeconds 60
```

Abra <http://127.0.0.1:4317>. O serviço escuta somente em loopback. Comandos de operação (mesma porta em todos):

```powershell
.\status.ps1 -Port 4317
.\stop.ps1 -Port 4317
.\start.ps1 -Port 4317 -SkipBuild   # reaproveita o build anterior
```

Não copie `node_modules`, `dist`, `.next` ou `out` de outro computador: `install.ps1` executa `npm ci` e o build. Exceção prática: sem rede para o registry, é possível copiar `node_modules` de uma máquina com o mesmo Node e o mesmo `package-lock.json` (`robocopy origem\node_modules destino\node_modules /E`) e rodar `.\start.ps1`, que só compila.

## 3. Rede corporativa (proxy, certificados, espelhos)

- O Tesseract não altera proxy, TLS nem registry. Configure-os antes no ambiente do usuário.
- Processos MCP locais (azmcp, uvx, docker, npx) recebem do Tesseract somente estas variáveis do ambiente: `PATH`, `PATHEXT`, `HOME`/`USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `TEMP`/`TMP`, `SystemRoot`/`WINDIR`, `ProgramFiles`, `HTTP(S)_PROXY`, `NO_PROXY` (maiúsculas e minúsculas), `SSL_CERT_FILE`, `NODE_EXTRA_CA_CERTS`, `REQUESTS_CA_BUNDLE`, `UV_NATIVE_TLS`, `UV_INDEX_URL`, `UV_DEFAULT_INDEX`, `PIP_INDEX_URL`, `PIP_CERT`, `npm_config_registry`, `DOCKER_HOST`, além das credenciais do próprio conector.
- Com CA corporativa, defina `NODE_EXTRA_CA_CERTS` (Node/npx) e `UV_NATIVE_TLS=1` ou `SSL_CERT_FILE` (uv) **antes** de `start.ps1`.
- Conexões MCP HTTP saem pelo transporte do Tesseract com DNS fixado (proteção SSRF) e não usam o proxy. Em rede que exige proxy para a internet, os conectores remotos (GitHub, Learn, AWS Knowledge, BigQuery, ARM MCP, Fabric) precisam de liberação direta ou de um servidor interno.

## 4. Recriar credenciais e integrações

Os segredos ficam em `%LOCALAPPDATA%\AzureCostLocal\config\vault`, protegidos por DPAPI do usuário Windows: **não são portáveis por cópia**. No host novo:

1. **Integrações → Credenciais**: cadastre Tenant ID, Client ID e, para identidade de aplicação, o *Secret Value*. Login de usuário exige o redirect `http://localhost:<porta>/api/auth/callback` na plataforma *Mobile and desktop* do app Entra.
2. **Integrações → Catálogo**: escolha o conector e informe só o que o cartão pede ("Você informa").

| Conector | Você informa |
|---|---|
| Azure (Advisor, Pricing, Quota, Monitor, Resource Health, Policy, Foundry) | Credencial Entra de aplicação; Advisor também a assinatura |
| Azure Cost Management (ARM MCP) | Login delegado com consentimento `MCP.Access` e escopo |
| GitHub (remoto) | PAT fine-grained ou token de GitHub App; para GHE.com troque a URL por `https://copilot-api.SUBDOMINIO.ghe.com/mcp` |
| GitHub Enterprise Server | `GITHUB_PERSONAL_ACCESS_TOKEN` e `GITHUB_HOST` (Docker obrigatório) |
| AWS Billing / Pricing | `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` (+ `AWS_SESSION_TOKEN`) ou `AWS_PROFILE`, e `AWS_REGION` |
| Google Cloud BigQuery | Access token OAuth (`gcloud auth print-access-token`, validade ~1 h) |
| OpenShift / Kubernetes (local) | `KUBECONFIG` com contexto de leitura |
| Microsoft Learn, AWS Knowledge | Nada |
| Hive, Db2, Teams, SMTP, LDAP | URL e token do servidor MCP interno da equipe |

3. Na integração: **Testar → Conectar e listar tools → aprovar leituras → Executar**.
4. **Agentes**: "GitHub Models (token corporativo)" usa `https://models.github.ai/orgs/SUA-ORG/inference`, modelo (ex.: `openai/gpt-4.1`) e um token com `models:read`. "Copilot local" usa o login do usuário no Copilot CLI.

## 5. Validar

```powershell
Invoke-RestMethod http://127.0.0.1:4317/api/health
npm test
```

Os testes unitários usam dados sintéticos. Os specs Playwright (`npm run test:e2e`) ainda apontam para a interface anterior à missão 22 e precisam ser reescritos; não os use como aceite. O aceite real é: uma credencial ativa, uma tool aprovada executada com sucesso por integração e um custo comparado com o portal no mesmo período e escopo.

## 6. O que não vai para o repositório

`.gitignore` exclui `node_modules/`, `dist/`, `.next/`, `out/`, `.env*` (exceto `.env.example`), logs e `*.tsbuildinfo`. Configuração e cofre ficam em `%LOCALAPPDATA%`, fora do checkout.

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
- Conexões MCP HTTP, modelos e agentes usam `HTTPS_PROXY`/`HTTP_PROXY` por túnel CONNECT, respeitando `NO_PROXY`. Endereços loopback e de rede privada vão sempre direto. Atrás do proxy, a falha de DNS local é aceita (o proxy resolve), mas um nome que resolva para rede privada continua bloqueado. `TESSERACT_PROXY=off` desativa o proxy para essas chamadas.

### Procedimento corporativo BB

Consultado em 25/11/2026 na documentação TechBB: **Binários — JFrog Artifactory**, seções *Configurar o Registry*, *NVM for Windows sem proxy*, *npm login* e *Configurações no projeto*; **BB Digital PF — Configuração local**, seção *Comandos rápidos*. A orientação específica do Binários de configurar o mirror prevalece sobre a FAQ genérica que apenas relata falhas de NVM na rede.

#### Node 24 LTS e PATH

NVM for Windows gerencia versões de **Node**, não instala pacotes MCP. Use a instalação de Node/NVM aprovada pela equipe da estação. Se já há Node em `C:\Program Files\nodejs`, não substitua essa pasta nem o symlink do NVM por conta própria: isso pode afetar outros processos/usuários. Na estação investigada, NVM não foi encontrado no PATH e o Node ativo era `v26.13.0`, fora do `engines` do projeto.

Com NVM for Windows já instalado e autorizado:

```powershell
nvm node_mirror https://binarios.intranet.bb.com.br/artifactory/generic-nodejsdist-remote
nvm install 24.22.3
nvm use 24.22.3
node.exe --version
npm.cmd --version
Get-Command node.exe,npm.cmd,npx.cmd | Select-Object Name,Source
```

`24.22.3` foi a versão mais recente da linha 24 marcada LTS no `index.json` do mirror nesta consulta; confirme a versão aprovada antes de instalar. O mínimo aceito pelo Tesseract é 24.6.0 na linha 24. Node 26 não é substituto compatível só por ter número maior.

Reabra o terminal/VS Code depois da instalação. Não é preciso modificar o PATH se `node.exe`, `npm.cmd` e `npx.cmd` já apontam para a instalação correta. Para uma distribuição ZIP corporativa já instalada e validada em pasta isolada, pode-se priorizar **somente a sessão atual**:

```powershell
$nodeDirectory = 'C:\CAMINHO\APROVADO\node-v24.22.3-win-x64'
if (-not (Test-Path -LiteralPath (Join-Path $nodeDirectory 'node.exe'))) {
    throw 'Informe a pasta da instalação corporativa do Node 24.'
}
$env:PATH = "$nodeDirectory;$env:PATH"
node.exe --version
npm.cmd --version
```

Execute preflight, instalação e início na mesma sessão para herdar esse PATH. O preflight não modifica PATH nem escolhe silenciosamente outro Node. O `node_mirror` é para downloads do Node pelo NVM; o registry do npm é outra configuração. A documentação consultada não exige `nvm npm_mirror` separado. Não use `nvm-sh` (POSIX) como se fosse NVM for Windows.

#### Obter e salvar o `.npmrc`

O template oficial fica em:

```text
https://binarios.intranet.bb.com.br:443/artifactory/generic-bb-binarios-aic-local/publico/alfred-templates/.npmrc
```

No PowerShell, com a confiança TLS corporativa já provisionada, baixe sem desativar a validação:

```powershell
$ErrorActionPreference = 'Stop'
$target = Join-Path $env:USERPROFILE '.npmrc'
$download = Join-Path $env:TEMP ("bb-npmrc-" + [guid]::NewGuid().ToString('N'))
Invoke-WebRequest -Uri 'https://binarios.intranet.bb.com.br:443/artifactory/generic-bb-binarios-aic-local/publico/alfred-templates/.npmrc' -OutFile $download
if (Test-Path -LiteralPath $target) {
    Copy-Item -LiteralPath $target -Destination ($target + '.backup-' + [guid]::NewGuid().ToString('N'))
}
# Revise e integre configurações pessoais necessárias antes de substituir.
Copy-Item -LiteralPath $download -Destination $target
Remove-Item -LiteralPath $download
npm.cmd config get registry
```

Não versione, imprima ou compartilhe `.npmrc` nem seu backup: podem conter tokens. Na estação investigada, o arquivo do usuário já configurava o registry correto, portanto **não foi sobrescrito**. Configuração de projeto e `npm_config_registry` podem prevalecer sobre o arquivo pessoal; consulte o registry efetivo dentro do checkout.

A documentação tem exemplos CMD com `curl -k`; este procedimento usa a alternativa PowerShell documentada, mantendo TLS habilitado. Não desative `strict-ssl`, não use `NODE_TLS_REJECT_UNAUTHORIZED=0` e não instale certificados sem aprovação. O `NODE_EXTRA_CA_CERTS` existente apontava para um arquivo presente; nenhuma CA foi alterada. Não invente proxy: o guia do Binários informa que NVM não requer proxy em notebook corporativo/VDI, inclusive TRI.

#### Login npm

Após configurar o `.npmrc`, o guia orienta fazer login no Binários e executar interativamente:

```powershell
npm.cmd login --registry=https://binarios.intranet.bb.com.br/artifactory/api/npm/npm/
```

Mantenha a barra final e informe a chave em minúsculas no fluxo oficial. Depois de autenticar, o guia orienta remover a chave legada `_auth`, caso exista, preservando a configuração de autenticação criada pelo npm. Não forneça credenciais ao assistente. Uma sessão válida já existente não exige novo login a cada execução. O preflight não verifica autenticação; HTTP 200 sem credenciais não prova autorização para pacotes internos.

#### MCPs: npm/npx, não NVM

Os três pacotes são distribuídos pelo npm. `npx.cmd` executa o pacote (baixando-o se necessário) usando a configuração corporativa do npm. NVM serve apenas para selecionar o Node que executará npm/npx.

Para inspecionar as versões disponíveis no registry antes de instalar:

```powershell
npm.cmd view @azure/mcp@latest version bin engines scripts --json
npm.cmd view @microsoft/fabric-mcp@latest version bin engines scripts --json
npm.cmd view kubernetes-mcp-server@latest version bin engines scripts --json
```

Na consulta de 25/11/2026: Azure `4.0.0-beta.10` (`azmcp`), Fabric `1.8.0` (`fabmcp`) e Kubernetes `0.1.3` (`kubernetes-mcp-server`). **`latest` não garante versão estável**: o Azure retornou beta. Azure e Fabric declaram `postinstall`; confirme aprovação dos scripts e dos downloads de binários nativos/espelhos com a infraestrutura. Metadados disponíveis no registry não comprovam que todos esses downloads são permitidos.

Se houver aprovação explícita para uma instalação global no prefixo npm do usuário, a sintaxe é:

```powershell
npm.cmd install --global @azure/mcp@latest @microsoft/fabric-mcp@latest kubernetes-mcp-server@latest
```

Isso não é necessário para o Tesseract: seus conectores executam versões fixadas via npx, e uma instalação global de `latest` não muda essas versões. Para validar somente a CLI de uma versão aprovada, sem conectar ao Azure/Fabric/cluster:

```powershell
npx.cmd --yes --package=@azure/mcp@3.0.0 azmcp --help
npx.cmd --yes --package=@microsoft/fabric-mcp@1.7.0 fabmcp --help
npx.cmd --yes kubernetes-mcp-server@0.1.3 --help
```

Esses comandos ainda podem instalar pacotes e executar scripts; não foram executados nesta correção. Não troque as versões fixadas sem uma atualização aprovada. Resolva pacotes e downloads adicionais nos espelhos do Binários; não contorne bloqueios acessando registries públicos.

#### Resultado da correção e próximo reteste

O relatório original tinha dois bloqueios. A investigação confirmou Node `v26.13.0` incompatível e um falso diagnóstico DNS: o proxy do Windows retornava `null`, e o script acessava `DnsSafeHost` desse resultado. O preflight agora trata proxy sem URI como conexão direta, mantém o caminho do registry e classifica falhas a partir do transporte HTTP.

O reteste de `.\preflight.ps1 -Port 4317 -ExportReport` aprovou o registry com HTTP 200 e manteve **um bloqueio real de versão do Node**, além de avisos dos endpoints opcionais ARM/MCP Registry. Regressões passaram em PowerShell 5.1 e 7. A instalação do Node ficou a cargo do usuário; nenhuma política, credencial, configuração npm ou PATH global foi alterada.

Depois de instalar/selecionar Node 24 aprovado, no checkout e na sessão com o PATH correto:

```powershell
.\preflight.ps1 -Port 4317 -ExportReport
```

O sucesso exige ausência de `[BLOQUEADO]`; a exceção final continua intencional quando há requisito obrigatório não atendido. Não removê-la para fazer o diagnóstico aparentar sucesso.

Se `nvm list` mostrar `No installations recognized`, instalar apenas o NVM não instalou Node: configure o mirror, instale a versão aprovada e selecione-a com `nvm use`. A presença da pasta `NVM_SYMLINK` no PATH sem `node.exe` nela não basta. No diagnóstico posterior desta estação, o mirror já estava correto, mas nenhuma versão era reconhecida pelo NVM. O preflight marca verificações dependentes de Node/npm indisponíveis como `INFORMATIVO` (não validadas), mantendo o bloqueio obrigatório de Node.

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
| Google Cloud BigQuery | JSON da conta de serviço (o Tesseract renova o token) ou, alternativa, access token OAuth de ~1 h |
| OpenShift / Kubernetes (local) | `KUBECONFIG` com contexto de leitura |
| Microsoft Learn, AWS Knowledge | Nada |
| Hive, Db2, Teams, SMTP, LDAP | URL e token do servidor MCP interno da equipe |

3. Na integração: **Testar → Conectar e listar tools → aprovar leituras → Executar**. Tools bloqueadas mostram o motivo (por exemplo, servidor sem `readOnlyHint`).
5. **FinOps → Licenças Copilot**: com uma integração GitHub cujo token seja de owner da organização (`manage_billing:copilot` ou `read:org`), mostra assentos cobrados, ativos e ociosos; o custo usa o preço por assento que você informar.
4. **Agentes**: "GitHub Models (token corporativo)" usa `https://models.github.ai/orgs/SUA-ORG/inference`, modelo (ex.: `openai/gpt-4.1`) e um token com `models:read`. "Copilot local" usa o login do usuário no Copilot CLI.

## 5. Validar

```powershell
Invoke-RestMethod http://127.0.0.1:4317/api/health
npm test
```

Os testes unitários usam dados sintéticos. As jornadas da interface atual estão em `npm run test:e2e:m22` (Edge no Windows): catálogo, formulário nativo, criar → conectar → aprovar → executar, centro operacional e tela estreita. Os demais specs Playwright ainda cobrem telas anteriores. O aceite real é: uma credencial ativa, uma tool aprovada executada com sucesso por integração e um custo comparado com o portal no mesmo período e escopo.

## 6. O que não vai para o repositório

`.gitignore` exclui `node_modules/`, `dist/`, `.next/`, `out/`, `.env*` (exceto `.env.example`), logs e `*.tsbuildinfo`. Configuração e cofre ficam em `%LOCALAPPDATA%`, fora do checkout.

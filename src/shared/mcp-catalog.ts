/**
 * Catálogo nativo de integrações MCP do Tesseract.
 *
 * Fonte única usada pelo servidor (validação, execução) e pela interface
 * (cartões do catálogo, formulário). Cada entrada descreve o que o usuário
 * precisa informar: credencial, token, variáveis de ambiente e, quando
 * aplicável, a URL. Endpoints e pacotes vêm da documentação oficial de cada
 * fornecedor (links em `docs`).
 */
export type CatalogGroup =
  | "azure"
  | "publica"
  | "privada"
  | "github"
  | "dados"
  | "conhecimento"
  | "colaboracao";

export type NativeAuth = "none" | "bearer" | "env" | "serviceAccount";

/** Modos em que o segredo é guardado no cofre do Tesseract. */
export const ownSecretModes = ["bearer", "env", "serviceAccount"];
export const ownSecret = (mode?: string) => !!mode && ownSecretModes.includes(mode);

export type Runner = {
  /** Executável procurado no PATH do host do Tesseract. */
  command: "npx" | "uvx" | "docker";
  args: string[];
  /** Variáveis fixas (não secretas) repassadas ao processo. */
  env?: Record<string, string>;
};

export type NativePreset = {
  id: string;
  label: string;
  provider: string;
  group: CatalogGroup;
  /** true: autenticação própria (token/env), sem identidade Azure. */
  independent: boolean;
  transport: "http" | "stdio";
  endpoint?: string;
  /** Regex (fonte) que o endpoint precisa atender. Ausente = qualquer HTTPS. */
  endpointPattern?: string;
  endpointHint?: string;
  auth: NativeAuth[];
  defaultAuth?: NativeAuth;
  tokenLabel?: string;
  tokenHelp?: string;
  /** Chaves aceitas no modo env (o resto é descartado). */
  envKeys?: string[];
  envTemplate?: string;
  runner?: Runner;
  requires?: string;
  /**
   * Quais tools podem ser aprovadas. "annotation" (padrão): somente as
   * marcadas readOnlyHint pelo servidor. "names": servidores só de leitura
   * por natureza; vale o bloqueio por nome (create/update/delete…).
   */
  toolPolicy?: "annotation" | "names";
  /** Escopo OAuth pedido ao Google no modo conta de serviço. */
  oauthScope?: string;
  summary: string;
  docs: string;
};

const AWS_ENV = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_REGION",
  "AWS_PROFILE",
];
const AWS_TEMPLATE =
  "AWS_ACCESS_KEY_ID=\nAWS_SECRET_ACCESS_KEY=\nAWS_REGION=us-east-1\n# ou somente AWS_PROFILE=perfil-finops";

export const nativePresets: NativePreset[] = [
  {
    id: "github",
    label: "GitHub (MCP oficial remoto)",
    provider: "GitHub",
    group: "github",
    independent: true,
    transport: "http",
    endpoint: "https://api.githubcopilot.com/mcp/",
    endpointPattern:
      "^https://(api\\.githubcopilot\\.com/mcp/?|copilot-api\\.[a-z0-9-]+\\.ghe\\.com/mcp/?)(readonly/?)?$",
    endpointHint:
      "GitHub.com: https://api.githubcopilot.com/mcp/ · GitHub Enterprise Cloud (ghe.com): https://copilot-api.SUBDOMINIO.ghe.com/mcp",
    auth: ["bearer"],
    tokenLabel: "Personal Access Token (fine-grained) ou token de GitHub App",
    tokenHelp:
      "Conceda só os repositórios e permissões de leitura necessários (Contents, Issues, Pull requests, Metadata). Políticas de PAT da organização se aplicam.",
    summary:
      "Repositórios, issues, PRs, Actions e código do GitHub corporativo — base do GitHub FinOps (specs, skills, ADRs).",
    docs: "https://docs.github.com/en/copilot/how-tos/provide-context/use-mcp/set-up-the-github-mcp-server",
  },
  {
    id: "github-local",
    label: "GitHub Enterprise Server (MCP local)",
    provider: "GitHub",
    group: "github",
    independent: true,
    transport: "stdio",
    auth: ["env"],
    envKeys: ["GITHUB_PERSONAL_ACCESS_TOKEN", "GITHUB_HOST", "GITHUB_TOOLSETS"],
    envTemplate:
      "GITHUB_PERSONAL_ACCESS_TOKEN=\nGITHUB_HOST=https://github.suaempresa.com.br\n# GITHUB_TOOLSETS=repos,issues,pull_requests",
    runner: {
      command: "docker",
      args: [
        "run",
        "-i",
        "--rm",
        "-e",
        "GITHUB_PERSONAL_ACCESS_TOKEN",
        "-e",
        "GITHUB_HOST",
        "-e",
        "GITHUB_TOOLSETS",
        "-e",
        "GITHUB_READ_ONLY",
        "ghcr.io/github/github-mcp-server",
      ],
      env: { GITHUB_READ_ONLY: "1" },
    },
    requires: "Docker no host do Tesseract (a imagem oficial é baixada no primeiro uso).",
    summary:
      "GitHub Enterprise Server não tem MCP remoto: o servidor oficial roda localmente em modo somente leitura.",
    docs: "https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/provide-context/use-mcp/enterprise-configuration",
  },
  {
    id: "mslearn",
    toolPolicy: "names",
    label: "Microsoft Learn",
    provider: "Microsoft",
    group: "conhecimento",
    independent: true,
    transport: "http",
    endpoint: "https://learn.microsoft.com/api/mcp",
    endpointPattern: "^https://learn\\.microsoft\\.com/api/mcp/?$",
    auth: ["none"],
    summary:
      "Documentação oficial Microsoft (Azure, FinOps Toolkit, Cost Management) com busca e exemplos de código. Sem credencial.",
    docs: "https://learn.microsoft.com/training/support/mcp",
  },
  {
    id: "aws-knowledge",
    toolPolicy: "names",
    label: "AWS Knowledge",
    provider: "Amazon Web Services",
    group: "conhecimento",
    independent: true,
    transport: "http",
    endpoint: "https://knowledge-mcp.global.api.aws",
    endpointPattern: "^https://knowledge-mcp\\.global\\.api\\.aws/?$",
    auth: ["none"],
    summary:
      "Documentação, disponibilidade regional e boas práticas AWS. Gerenciado pela AWS, sem credencial.",
    docs: "https://awslabs.github.io/mcp/servers/aws-knowledge-mcp-server",
  },
  {
    id: "aws-billing",
    toolPolicy: "names",
    label: "AWS Billing and Cost Management",
    provider: "Amazon Web Services",
    group: "publica",
    independent: true,
    transport: "stdio",
    auth: ["env"],
    envKeys: AWS_ENV,
    envTemplate: AWS_TEMPLATE,
    runner: {
      command: "uvx",
      args: ["awslabs.billing-cost-management-mcp-server@0.0.46"],
      env: { FASTMCP_LOG_LEVEL: "ERROR" },
    },
    requires: "uv instalado no host (comando uvx no PATH) e IAM com leitura de Cost Explorer, Budgets e Compute Optimizer.",
    summary:
      "Cost Explorer, Budgets, anomalias, Savings Plans, Compute Optimizer e Cost Optimization Hub.",
    docs: "https://awslabs.github.io/mcp/servers/billing-cost-management-mcp-server",
  },
  {
    id: "aws-pricing",
    toolPolicy: "names",
    label: "AWS Pricing",
    provider: "Amazon Web Services",
    group: "publica",
    independent: true,
    transport: "stdio",
    auth: ["env"],
    envKeys: AWS_ENV,
    envTemplate: AWS_TEMPLATE,
    runner: {
      command: "uvx",
      args: ["awslabs.aws-pricing-mcp-server@1.1.2"],
      env: { FASTMCP_LOG_LEVEL: "ERROR" },
    },
    requires: "uv instalado no host (uvx no PATH) e permissão pricing:* no IAM.",
    summary: "Preços públicos de serviços AWS para estimativas e what-if.",
    docs: "https://awslabs.github.io/mcp/servers/aws-pricing-mcp-server",
  },
  {
    id: "gcp-bigquery",
    label: "Google Cloud BigQuery",
    provider: "Google Cloud",
    group: "publica",
    independent: true,
    transport: "http",
    endpoint: "https://bigquery.googleapis.com/mcp",
    endpointPattern: "^https://bigquery\\.googleapis\\.com/mcp/?$",
    auth: ["serviceAccount", "bearer"],
    defaultAuth: "serviceAccount",
    oauthScope: "https://www.googleapis.com/auth/bigquery",
    tokenLabel: "Access token OAuth 2.0 (gcloud auth print-access-token)",
    tokenHelp:
      "Token de curta duração (≈1 h, sem renovação). Prefira a conta de serviço: o Tesseract renova o token sozinho.",
    summary:
      "Consultas no export de billing do GCP (FinOps) e metadados de datasets. O servidor remoto não aceita API key.",
    docs: "https://docs.cloud.google.com/bigquery/docs/use-bigquery-mcp",
  },
  {
    id: "openshift",
    label: "OpenShift / Kubernetes (kubeconfig local)",
    provider: "Red Hat OpenShift",
    group: "privada",
    independent: true,
    transport: "stdio",
    auth: ["env"],
    envKeys: ["KUBECONFIG"],
    envTemplate: "KUBECONFIG=C:\\Users\\voce\\.kube\\config",
    runner: {
      command: "npx",
      args: ["--yes", "kubernetes-mcp-server@0.1.3", "--read-only"],
    },
    requires: "Node.js (já presente) e um kubeconfig com contexto de leitura no cluster.",
    summary:
      "Pods, nodes, namespaces, eventos e recursos do cluster em modo somente leitura (inclui projetos OpenShift).",
    docs: "https://github.com/containers/kubernetes-mcp-server",
  },
  {
    id: "kubernetes",
    label: "OpenShift / Kubernetes (servidor HTTP)",
    provider: "Red Hat OpenShift",
    group: "privada",
    independent: true,
    transport: "http",
    auth: ["none", "bearer"],
    defaultAuth: "bearer",
    endpointHint: "URL do kubernetes-mcp-server exposto no cluster (ex.: https://mcp.apps.cluster.interno/mcp)",
    tokenLabel: "Token Bearer do endpoint MCP",
    summary: "Servidor MCP já publicado dentro do cluster, com token próprio.",
    docs: "https://github.com/containers/kubernetes-mcp-server",
  },
  {
    id: "custom",
    label: "Servidor MCP personalizado (HTTP)",
    provider: "Interno",
    group: "dados",
    independent: true,
    transport: "http",
    auth: ["none", "bearer"],
    defaultAuth: "bearer",
    endpointHint: "URL Streamable HTTP do servidor (https://…/mcp)",
    tokenLabel: "Token Bearer do endpoint MCP",
    summary: "Qualquer servidor MCP remoto que a sua equipe opere.",
    docs: "https://modelcontextprotocol.io/specification",
  },
];

/** Presets com identidade Microsoft Entra (fluxo já existente). */
export const microsoftPresetIds = [
  "azure",
  "adx",
  "foundry",
  "fabric",
  "powerbi",
  "arm",
] as const;

export const presetIds = [
  ...microsoftPresetIds,
  ...nativePresets.map((p) => p.id),
] as [string, ...string[]];

export function nativePreset(id?: string) {
  return nativePresets.find((p) => p.id === id);
}

export function isIndependentPreset(id?: string) {
  return !!nativePreset(id)?.independent;
}

/** Converte o texto KEY=VALUE do cofre em variáveis permitidas. */
export function parseEnvSecret(text: string, allowed: string[]) {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = line.indexOf("=");
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    const value = line.slice(at + 1).trim();
    if (allowed.includes(key) && value) out[key] = value;
  }
  return out;
}

/** Versões do Azure MCP Server aceitas (pacote fixado). */
export const azmcpVersions = [
  { id: "3.0.0", label: "3.0.0 · estável", note: "Advisor: 5 tools de leitura." },
  {
    id: "4.0.0-beta.10",
    label: "4.0.0-beta.10 · prévia",
    note: "Advisor: 8 tools de leitura (+ insights, pré-validação de remoção e inteligência de service groups). Versão beta.",
  },
] as const;
export function azmcpPackage(version?: string) {
  return "@azure/mcp@" + (azmcpVersions.some((v) => v.id === version) ? version : "3.0.0");
}

/**
 * Namespaces do azmcp liberados em modo somente leitura. `tools`: quantidade anunciada
 * com --read-only, medida por tools/list (3.0.0 / 4.0.0-beta.10, 25/11/2026).
 */
export const azureNamespaces: { id: string; label: string; group: string; tools: [number, number] }[] = [
  { id: "pricing", label: "Preços de catálogo", group: "FinOps", tools: [1, 1] },
  { id: "advisor", label: "Recomendações Advisor", group: "FinOps", tools: [5, 8] },
  { id: "optimization", label: "Otimização", group: "FinOps", tools: [3, 3] },
  { id: "quota", label: "Cotas e uso", group: "FinOps", tools: [2, 2] },
  { id: "subscription", label: "Inventário de assinaturas", group: "Inventário", tools: [1, 1] },
  { id: "group", label: "Resource groups", group: "Inventário", tools: [2, 2] },
  { id: "monitor", label: "Azure Monitor (logs e métricas)", group: "Observabilidade", tools: [14, 22] },
  { id: "applicationinsights", label: "Application Insights", group: "Observabilidade", tools: [1, 1] },
  { id: "resourcehealth", label: "Resource Health", group: "Observabilidade", tools: [2, 2] },
  { id: "workbooks", label: "Workbooks", group: "Observabilidade", tools: [2, 2] },
  { id: "policy", label: "Azure Policy", group: "Governança", tools: [1, 1] },
  { id: "foundry", label: "Foundry (modelos e deployments)", group: "IA e tokens", tools: [0, 0] },
];

/** Namespaces gravados em resourceContext.namespace (lista separada por vírgula). */
export function parseNamespaces(value?: string): string[] {
  const list = [...new Set((value || "pricing").split(",").map((x) => x.trim()).filter(Boolean))];
  return list.length ? list : ["pricing"];
}

/** Ferramentas esperadas para uma seleção, pela medição acima (índice 0 = 3.0.0, 1 = 4.0 beta). */
export function expectedAzureTools(namespaces: string[], version?: string) {
  const i = version?.startsWith("4.") ? 1 : 0;
  return namespaces.reduce((n, id) => n + (azureNamespaces.find((x) => x.id === id)?.tools[i] ?? 0), 0);
}

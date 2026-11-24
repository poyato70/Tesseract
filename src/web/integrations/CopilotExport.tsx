/**
 * Exporta a integração para o GitHub Copilot (VS Code `.vscode/mcp.json`).
 * Segredos nunca são incluídos: viram `inputs` do tipo promptString.
 */
import { useState } from "react";
import { Copy } from "lucide-react";
import { nativePreset } from "../../shared/mcp-catalog.js";
import type { IntegrationProfile } from "./model.js";

export function copilotConfig(p: IntegrationProfile) {
  const id = (p.name || p.preset).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || p.preset;
  const inputs: { type: "promptString"; id: string; description: string; password: true }[] = [];
  const secret = (key: string, description: string) => {
    inputs.push({ type: "promptString", id: `${id}-${key.toLowerCase()}`, description, password: true });
    return `\${input:${id}-${key.toLowerCase()}}`;
  };
  const native = nativePreset(p.preset);
  let server: Record<string, unknown>;
  if (p.transport === "http") {
    server = { type: "http", url: p.endpoint || native?.endpoint };
    if (p.authMode === "bearer") server.headers = { Authorization: `Bearer ${secret("token", native?.tokenLabel || "Token do servidor MCP")}` };
  } else if (native?.runner) {
    const env: Record<string, string> = { ...(native.runner.env || {}) };
    for (const k of native.envKeys || []) if (!/PROFILE|REGION|HOST|TOOLSETS|KUBECONFIG/.test(k) || k === "GITHUB_PERSONAL_ACCESS_TOKEN") env[k] = secret(k, k);
    server = { type: "stdio", command: native.runner.command, args: native.runner.args, env };
  } else {
    const args = ["-y", p.preset === "fabric" ? "@microsoft/fabric-mcp@1.7.0" : "@azure/mcp@3.0.0", "server", "start", "--read-only"];
    if (p.preset === "azure") args.push("--namespace", p.resourceContext?.namespace || "pricing");
    if (p.preset === "adx") args.push("--namespace", "kusto");
    server = {
      type: "stdio",
      command: "npx",
      args,
      env:
        p.authMode === "application"
          ? { AZURE_TENANT_ID: secret("tenant", "Tenant ID"), AZURE_CLIENT_ID: secret("client", "Client ID"), AZURE_CLIENT_SECRET: secret("secret", "Client Secret"), AZURE_TOKEN_CREDENTIALS: "EnvironmentCredential" }
          : {},
    };
  }
  return JSON.stringify({ inputs, servers: { [id]: server } }, null, 2);
}

export function CopilotExport({ profile }: { profile: IntegrationProfile }) {
  const [copied, setCopied] = useState(false);
  const json = copilotConfig(profile);
  return (
    <details className="if-summary cpx">
      <summary>Usar esta integração no GitHub Copilot (VS Code)</summary>
      <p className="if-fine">
        Cole em <code>.vscode/mcp.json</code>. Segredos não são exportados: o VS Code pede cada valor na primeira execução. Políticas de MCP do Copilot da organização continuam valendo.
      </p>
      <pre>{json}</pre>
      <button
        type="button"
        className="lx-btn"
        onClick={() => {
          void navigator.clipboard?.writeText(json).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          });
        }}
      >
        <Copy size={14} aria-hidden="true" /> {copied ? "Copiado" : "Copiar mcp.json"}
      </button>
    </details>
  );
}

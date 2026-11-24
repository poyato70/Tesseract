import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join, win32 } from "node:path";
const require = createRequire(import.meta.url);
export function resolveCopilotPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  exists: (p: string) => boolean = existsSync,
) {
  const paths = env.PATH || env.Path || "";
  const pathApi = platform === "win32" ? win32 : { join };
  const candidates = [
    env.COPILOT_CLI_PATH,
    ...paths
      .split(platform === "win32" ? ";" : ":")
      .map((p) =>
        pathApi.join(p, platform === "win32" ? "copilot.exe" : "copilot"),
      ),
  ];
  const found = candidates.find((p): p is string => !!p && exists(p));
  if (!found) throw new Error("Copilot CLI não encontrado no PATH.");
  return found;
}

/** Pacote de runtime do Copilot empacotado com o SDK para esta plataforma. */
export function bundledRuntimePackage(platform = process.platform, arch = process.arch) {
  return `@github/copilot-sdk-${platform}-${arch}`;
}

/**
 * Ordem de escolha do runtime do Copilot:
 * 1. COPILOT_CLI_PATH (caminho absoluto informado pelo usuário);
 * 2. runtime empacotado com o SDK (mesma versão do SDK — evita incompatibilidade
 *    com o CLI global, que muda de versão sozinho);
 * 3. copilot(.exe) no PATH.
 * Retorna undefined para "usar o runtime empacotado".
 */
export function chooseCopilotRuntime(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  exists: (p: string) => boolean = existsSync,
  hasBundled: () => boolean = () => {
    try {
      require.resolve(bundledRuntimePackage(platform) + "/package.json");
      return true;
    } catch {
      return false;
    }
  },
): { path?: string; source: "env" | "bundled" | "path" } {
  if (env.COPILOT_CLI_PATH) {
    if (!exists(env.COPILOT_CLI_PATH))
      throw new Error(`COPILOT_CLI_PATH aponta para um arquivo inexistente: ${env.COPILOT_CLI_PATH}`);
    return { path: env.COPILOT_CLI_PATH, source: "env" };
  }
  if (hasBundled()) return { source: "bundled" };
  return { path: resolveCopilotPath(env, platform, exists), source: "path" };
}

import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { AppError } from "../errors.js";
import type { Runner } from "../../shared/mcp-catalog.js";

const install: Record<Runner["command"], string> = {
  npx: "Node.js com npm",
  uvx: "uv (https://docs.astral.sh/uv/) — depois rode `uv --version` no mesmo terminal do Tesseract",
  docker: "Docker Desktop ou Docker Engine em execução",
};

async function exists(path: string, mode = constants.X_OK) {
  try {
    await access(path, mode);
    return true;
  } catch {
    return false;
  }
}

/** Procura o executável no PATH, considerando extensões do Windows. */
export async function findOnPath(name: string, env = process.env) {
  const dirs = (env.PATH || env.Path || "").split(delimiter).filter(Boolean);
  const exts =
    process.platform === "win32"
      ? (env.PATHEXT || ".EXE;.CMD;.BAT").split(";").map((e) => e.toLowerCase())
      : [""];
  for (const dir of dirs)
    for (const ext of exts) {
      const candidate = join(dir, name + ext);
      if (await exists(candidate)) return candidate;
    }
  return undefined;
}

/**
 * Resolve o comando do executor. npx usa o npm empacotado com o Node do
 * Tesseract (mesmo caminho do azmcp); uvx e docker precisam estar no PATH.
 */
export async function resolveRunner(runner: Runner) {
  if (runner.command === "npx") {
    const cli = join(dirname(process.execPath), "node_modules/npm/bin/npx-cli.js");
    if (await exists(cli, constants.F_OK)) return { command: process.execPath, args: [cli, ...runner.args] };
    const npx = await findOnPath("npx");
    if (npx) return { command: npx, args: runner.args };
  } else {
    const found = await findOnPath(runner.command);
    if (found) return { command: found, args: runner.args };
  }
  throw new AppError(
    "unsupported",
    `O executor "${runner.command}" não foi encontrado no host do Tesseract. Instale ${install[runner.command]} e reinicie o Tesseract.`,
  );
}

import { it, expect } from "vitest";
import { resolveCopilotPath } from "../../src/server/chat/runtime.js";
it("resolves an absolute executable path on Windows without shell", () => {
  expect(
    resolveCopilotPath(
      { PATH: "C:\\tools;C:\\cli" } as any,
      "win32",
      (p) => p === "C:\\cli\\copilot.exe",
    ),
  ).toBe("C:\\cli\\copilot.exe");
});
import { chooseCopilotRuntime } from "../../src/server/chat/runtime.js";
it("prefere COPILOT_CLI_PATH, depois o runtime empacotado, depois o PATH", () => {
  const yes = () => true, no = () => false;
  expect(chooseCopilotRuntime({ COPILOT_CLI_PATH: "C:\\c\\copilot.exe" } as any, "win32", yes, yes)).toEqual({ path: "C:\\c\\copilot.exe", source: "env" });
  expect(chooseCopilotRuntime({ PATH: "C:\\cli" } as any, "win32", yes, yes)).toEqual({ source: "bundled" });
  expect(chooseCopilotRuntime({ PATH: "C:\\cli" } as any, "win32", (p) => p === "C:\\cli\\copilot.exe", no)).toEqual({ path: "C:\\cli\\copilot.exe", source: "path" });
  expect(() => chooseCopilotRuntime({ COPILOT_CLI_PATH: "C:\\x.exe" } as any, "win32", no, yes)).toThrow(/inexistente/);
});

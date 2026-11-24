import { defineConfig } from "@playwright/test";
import { createUniqueTestOutputDir } from "./scripts/test-path-safety.js";

/** Jornadas da interface da missão 22. Windows: Edge; CI/Linux: Chromium. */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["missao-22-jornadas.spec.ts"],
  workers: 1,
  timeout: 60000,
  expect: { timeout: 8000 },
  outputDir: createUniqueTestOutputDir("tesseract-playwright-m22-"),
  reporter: "list",
  use: {
    headless: true,
    ...(process.env.PW_CHROME ? { launchOptions: { executablePath: process.env.PW_CHROME, args: ["--no-sandbox"] } } : {}),
    ...(process.env.CI || process.platform !== "win32" ? {} : { channel: "msedge" }),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});

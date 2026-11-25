/**
 * Jornadas da interface da missão 22 (catálogo → integração → testar → executar
 * → centro operacional). Sobe a fixture MCP HTTP e o Tesseract em portas
 * próprias, com dados isolados. Para apontar para instâncias já em execução:
 * TESSERACT_E2E_URL e TESSERACT_E2E_MCP.
 */
import { test, expect } from "./fixtures.js";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

const external = process.env.TESSERACT_E2E_URL;
const appPort = 14522;
let base = external || `http://127.0.0.1:${appPort}`;
let mcpUrl = process.env.TESSERACT_E2E_MCP || "";
const children: ChildProcess[] = [];

async function waitFor(url: string, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Sem resposta: " + url);
}

test.beforeAll(async () => {
  if (external) return;
  const root = await mkdtemp(join(tmpdir(), "tesseract-m22-e2e-"));
  const fixture = spawn(process.execPath, ["--import", "tsx", join("tests", "fixtures", "mcp-mission10-server.ts"), "--http"], {
    env: { ...process.env, TESSERACT_TEST_RUNTIME: "1", TESSERACT_TEST_DATA_DIR: join(root, "fx"), M10_FIXTURE_TEMP: join(root, "fx-effects") },
    stdio: ["ignore", "pipe", "ignore"],
  });
  children.push(fixture);
  let port = 0;
  fixture.stdout!.on("data", (c) => {
    try {
      port = JSON.parse(String(c).split("\n")[0]).port;
    } catch {}
  });
  const until = Date.now() + 20000;
  while (!port && Date.now() < until) await new Promise((r) => setTimeout(r, 100));
  if (!port) throw new Error("Fixture MCP não publicou a porta.");
  mcpUrl = `http://127.0.0.1:${port}/mcp`;
  const data = join(root, "app");
  await mkdir(data, { recursive: true });
  const app = spawn(process.execPath, ["dist/server/main.js"], {
    env: {
      ...process.env,
      PORT: String(appPort),
      LOCALAPPDATA: join(root, "local"),
      TESSERACT_TEST_RUNTIME: "1",
      TESSERACT_TEST_DATA_DIR: data,
      TESSERACT_TEST_PROTECTED_ROOTS: JSON.stringify([join(process.env.LOCALAPPDATA || tmpdir(), "AzureCostLocal")]),
      AZURE_TENANT_ID: "",
      AZURE_CLIENT_ID: "",
    },
    stdio: "ignore",
  });
  children.push(app);
  await waitFor(`${base}/api/health`);
});

test.afterAll(() => {
  for (const c of children) c.kill();
});

test.describe.configure({ mode: "serial" });

test("1 · catálogo mostra conectores nativos agrupados e filtra", async ({ page }) => {
  await page.goto(base + "/integracoes/catalogo");
  await expect(page.getByRole("tab", { name: "Conectores prontos" })).toHaveAttribute("aria-selected", "true");
  for (const t of ["Azure Advisor", "GitHub (MCP oficial remoto)", "AWS Billing and Cost Management", "Microsoft Learn"])
    await expect(page.getByRole("heading", { level: 3 }).or(page.locator(".cat-card strong")).filter({ hasText: t }).first()).toBeVisible();
  await page.getByLabel("Filtrar conectores").fill("openshift");
  await expect(page.locator(".cat-card")).toHaveCount(2);
});

test("2 · formulário nativo pede só o que o conector precisa", async ({ page }) => {
  await page.goto(base + "/integracoes/nova");
  await page.getByLabel("Serviço").selectOption("github");
  await expect(page.getByLabel(/URL do servidor/)).toHaveValue("https://api.githubcopilot.com/mcp/");
  await expect(page.getByText("3 · Escopo")).toHaveCount(0);
  await page.getByLabel("Serviço").selectOption("aws-billing");
  await page.getByRole("button", { name: /Inserir modelo/ }).click();
  await expect(page.locator("textarea.if-env")).toHaveValue(/AWS_ACCESS_KEY_ID=/);
});

let integrationUrl = "";
test("3 · cria integração, conecta, aprova e executa", async ({ page }) => {
  await page.goto(base + "/");
  const created = await page.evaluate(async (endpoint) => {
    const b = await (await fetch("/api/bootstrap")).json();
    const r = await fetch("/api/mcp-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": b.csrf },
      body: JSON.stringify({ name: "Servidor E2E", preset: "custom", transport: "http", endpoint, authMode: "none", allowPrivateNetwork: true, resourceContext: {}, approvedTools: [] }),
    });
    return r.json();
  }, mcpUrl);
  integrationUrl = `${base}/integracoes/${created.id}`;
  await page.goto(integrationUrl + "/testar");
  await page.getByRole("button", { name: /Conectar e listar tools/ }).click();
  const boxes = page.locator(".tt-tools input[type=checkbox]:not([disabled])");
  await expect(boxes.first()).toBeVisible();
  await boxes.first().check();
  await page.getByRole("button", { name: "Salvar aprovações" }).click();
  await page.getByRole("button", { name: "Visão de integração" }).click();
  await page.getByRole("button", { name: /Executar agora/ }).click();
  await expect(page.getByText("Concluída com sucesso")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Como funciona esta conexão")).toBeVisible();
});

test("4 · centro operacional mostra a integração sem contar leituras automáticas", async ({ page }) => {
  await page.goto(base + "/");
  await expect(page.locator(".fc-card").filter({ hasText: "Servidor E2E" }).first()).toBeVisible();
  await expect(page.getByText(/ações · sem leituras automáticas/)).toBeVisible();
  await expect(page.locator(".op-feed")).not.toContainText("GET /api/");
});

test("5 · tela estreita usa lista vertical", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/");
  await expect(page.locator(".op-lane").filter({ hasText: "Servidor E2E" }).first()).toBeVisible();
  await expect(page.locator(".op-canvas")).toBeHidden();
});

test("6 · Índigo é o padrão e o Grafite continua disponível", async ({ page }) => {
  await page.goto(base + "/");
  await page.evaluate(() => localStorage.removeItem("tesseract-palette"));
  await page.reload();
  const toggle = page.locator(".tb-palette");
  await expect(toggle).toHaveText(/Índigo/);
  await expect(page.locator("html")).toHaveAttribute("data-palette", "indigo");
  const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const indigo = await bodyBg();
  await toggle.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-palette", /.+/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await bodyBg()).not.toBe(indigo);
  await page.reload();
  await expect(page.locator(".tb-palette")).toHaveText(/Grafite/);
  await page.locator(".tb-palette").click();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "indigo");
  expect(await bodyBg()).toBe(indigo);
});

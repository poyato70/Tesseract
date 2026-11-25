import { assertArmChatScope } from "../mcp/arm-policy.js";
import { emitHubEvidence } from "../hubs/evidence.js";
import type { HubService } from "../hubs/service.js";
import { hubOperation } from "../../shared/hubs.js";
import {
  CopilotClient,
  RuntimeConnection,
  defineTool,
  type CopilotSession,
} from "@github/copilot-sdk";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import {
  executeQuestionTool,
  ensureQuestionScope,
  restrictedSessionConfig,
  toolParameters,
  type QueryServices,
} from "./tools.js";
import { AppError, assertActive } from "../errors.js";
import type {
  RequestContext,
  Scope,
  CostQuery,
  ChatEvent,
} from "../../shared/contracts.js";
import { chooseCopilotRuntime } from "./runtime.js";
import { toolHint } from "../../shared/tool-hints.js";
import type { McpRegistry } from "../mcp/registry.js";
import type { DataSelection } from "../../shared/connections.js";
import { z } from "zod";
export class CopilotChat {
  private client?: CopilotClient;
  private starting?: Promise<CopilotClient>;
  private busy = new Set<string>();
  private runtimeSource?: "env" | "bundled" | "path";
  constructor(
    private services: QueryServices,
    private mcps?: McpRegistry,
    private hubs?: HubService,
  ) {}
  private async getClient() {
    if (this.client) return this.client;
    if (!this.starting)
      this.starting = (async () => {
        const cwd = join(tmpdir(), "azure-cost-local-empty");
        await mkdir(cwd, { recursive: true });
        const client = new CopilotClient({
          mode: "empty",
          baseDirectory: join(homedir(), ".copilot"),
          workingDirectory: cwd,
          connection: (() => {
            const runtime = chooseCopilotRuntime();
            this.runtimeSource = runtime.source;
            return RuntimeConnection.forStdio(runtime.path ? { path: runtime.path } : {});
          })(),
        });
        await client.start();
        this.client = client;
        return client;
      })().catch((e) => {
        this.starting = undefined;
        throw e;
      });
    return this.starting;
  }
  async status() {
    try {
      const client = await this.getClient();
      const auth = await client.getAuthStatus();
      return {
        available: auth.isAuthenticated,
        message: auth.isAuthenticated
          ? "Copilot CLI autenticado. As ferramentas são verificadas antes de cada pergunta."
          : "Entre no Copilot CLI para habilitar o chat.",
      };
    } catch (e) {
      // mostra a causa real (sem caminhos de usuário) para orientar a correção
      const cause = String((e as Error)?.message || e)
        .replace(/[A-Za-z]:\\Users\\[^\\\s]+/g, "%USERPROFILE%")
        .replace(/\/home\/[^/\s]+/g, "~")
        .slice(0, 240);
      return {
        available: false,
        message: `Copilot indisponível (${this.runtimeSource === "bundled" ? "runtime empacotado no Tesseract" : this.runtimeSource === "env" ? "COPILOT_CLI_PATH" : "CLI do PATH"}): ${cause}. Faça login com \`copilot\` → /login ou defina COPILOT_CLI_PATH para um copilot.exe compatível.`,
      };
    }
  }
  async ask(
    ctx: RequestContext,
    input: {
      message: string;
      scope?: Scope;
      basis: CostQuery["basis"];
      selection?: DataSelection;
    },
    emit: (e: ChatEvent) => void,
  ) {
    ensureQuestionScope(input.message, input.scope);
    if (this.busy.has(ctx.sessionId))
      throw new AppError("invalid_request", "Aguarde a resposta anterior.");
    this.busy.add(ctx.sessionId);
    let session: CopilotSession | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let client: CopilotClient | undefined;
    const controller = new AbortController();
    const abort = () => controller.abort();
    ctx.signal.addEventListener("abort", abort, { once: true });
    const localCtx = {
      ...ctx,
      signal: AbortSignal.any([ctx.signal, controller.signal]),
    };
    const started = Date.now();
    let inputTokens: number | undefined, outputTokens: number | undefined;
    let unwatchUsage: (() => void) | undefined;
    let calls = 0;
    let unwatchHub: (() => void) | undefined;
    try {
      if (input.selection?.hubId && this.hubs)
        unwatchHub = await this.hubs.watch(input.selection.hubId, controller);
      client = await this.getClient();
      if (!(await client.getAuthStatus()).isAuthenticated)
        throw new AppError(
          "unauthenticated",
          "Entre primeiro no Copilot CLI.",
          401,
        );
      let tool: any = defineTool("azure_query", {
        description:
          "Consulta somente o escopo selecionado no dashboard. Sem período usa dois meses civis completos anteriores. Operações: custos, previsão (forecast, padrão mês atual), comparação, budgets, Reservations e Savings Plans.",
        parameters: toolParameters,
        skipPermission: true,
        handler: async (args) => {
          assertActive(localCtx.signal);
          if (++calls > 10) {
            controller.abort();
            throw new AppError(
              "invalid_request",
              "Limite de dez consultas por pergunta atingido.",
            );
          }
          emit({
            type: "progress",
            message: `Consultando APIs Azure · ${args.operation} · leitura ${calls}…`,
          });
          const result = await executeQuestionTool(
            this.services,
            localCtx,
            input.scope,
            input.basis,
            args,
          );
          assertActive(localCtx.signal);
          const cost = result.current || result;
          if (cost?.forecastTotals)
            emit({ type: "forecastEvidence", result: cost });
          else if (cost?.meta) emit({ type: "result", result: cost });
          return JSON.stringify(result);
        },
      });
      if (input.selection?.source === "mcp" && !input.selection?.hubId) {
        const id = input.selection.mcpConnectionId;
        if (!id || !this.mcps)
          throw new AppError("invalid_request", "Selecione uma conexão MCP.");
        const profile = await this.mcps.get(id);
        if (profile.preset === "arm")
          assertArmChatScope(profile.resourceContext.scope || "", input.scope);
        tool = defineTool("mcp_query", {
          description:
            "Descobrir ferramentas de leitura aprovadas e consultar o MCP selecionado. operation list descobre schemas; call executa somente ferramenta aprovada.",
          parameters: z
            .object({
              operation: z.enum(["list", "call"]),
              name: z.string().optional(),
              arguments: z.record(z.string(), z.unknown()).optional(),
            })
            .strict(),
          skipPermission: true,
          handler: async (args) => {
            assertActive(localCtx.signal);
            if (++calls > 10)
              throw new AppError(
                "limit_exceeded",
                "Limite de consultas atingido.",
              );
            emit({
              type: "progress",
              message: `MCP · ${args.operation === "list" ? "descobrindo tools aprovadas" : args.name || "leitura"}…`,
            });
            if (args.operation === "list")
              return JSON.stringify(
                (await this.mcps!.tools(localCtx, id)).filter(
                  (t) => t.reviewable && t.approved,
                ),
              );
            if (!args.name)
              throw new AppError(
                "invalid_request",
                "Ferramenta não informada.",
              );
            const result = await this.mcps!.call(
              localCtx,
              id,
              args.name,
              args.arguments || {},
            );
            assertActive(localCtx.signal);
            emit({ type: "mcpEvidence", result });
            return JSON.stringify(result);
          },
        });
      }
      if (input.selection?.hubId) {
        const hubId = input.selection.hubId;
        tool = defineTool("finops_hub", {
          description:
            "Consulta Hub para RG nos dois meses civis completos: custos, conciliação informativa e recomendações de benefícios disponíveis.",
          parameters: z.object({ operation: hubOperation }).strict(),
          skipPermission: true,
          handler: async (args) => {
            if (++calls > 10)
              throw new AppError(
                "limit_exceeded",
                "Limite de consultas atingido.",
              );
            if (!this.hubs || !input.scope)
              throw new AppError("invalid_request", "Selecione um RG e Hub.");
            emit({
              type: "progress",
              message: `FinOps hub · ${args.operation}…`,
            });
            const r = await this.hubs.run(
              localCtx,
              hubId,
              input.scope,
              input.basis,
              args.operation,
            );
            assertActive(localCtx.signal);
            emitHubEvidence(r, emit);
            return JSON.stringify(r);
          },
        });
      }
      // Catálogo do Tesseract: só metadados (integrações e tools aprovadas),
      // nenhuma leitura de dados. Permite responder "quais tools existem?".
      const catalogTool: any = defineTool("tesseract_catalog", {
        description:
          "Lista as integrações MCP cadastradas no Tesseract, as tools aprovadas de cada uma (com finalidade e anotações) e as tools anunciadas pelo servidor quando a integração está conectada. Não consulta dados. Use para perguntas como 'quais tools estão disponíveis para o Advisor?'. Para executar uma tool, o usuário precisa escolher a fonte MCP da integração no seletor do chat.",
        parameters: z.object({ filter: z.string().max(80).optional() }).strict(),
        skipPermission: true,
        handler: async (args) => {
          assertActive(localCtx.signal);
          if (!this.mcps) return JSON.stringify({ integrations: [] });
          emit({ type: "progress", message: "Catálogo do Tesseract · listando integrações e tools…" });
          const q = (args.filter || "").toLowerCase();
          const list = await this.mcps.list(ctx.sessionId);
          const out = [];
          for (const p of list as any[]) {
            const text = [p.name, p.preset, p.resourceContext?.namespace].join(" ").toLowerCase();
            if (q && !text.includes(q) && !(p.approvedTools || []).some((t: any) => t.name.includes(q))) continue;
            let announced: any[] | undefined;
            if (p.connected)
              announced = (await this.mcps.tools(localCtx, p.id)).map((t: any) => ({
                name: t.name,
                approvable: t.reviewable,
                approved: t.approved,
                annotations: t.annotations,
                purpose: toolHint(t.name)?.purpose,
                blockedReason: t.blockedReason,
              }));
            out.push({
              integration: p.name,
              service: p.preset,
              group: p.resourceContext?.namespace,
              azmcpVersion: p.resourceContext?.azmcpVersion,
              connected: !!p.connected,
              approvedTools: (p.approvedTools || []).map((t: any) => ({ name: t.name, purpose: toolHint(t.name)?.purpose })),
              announcedTools: announced,
              howToRun: "Selecione esta integração como fonte MCP no chat ou use Integrações > Testar.",
            });
          }
          return JSON.stringify({
            integrations: out,
            note: "announcedTools só aparece para integrações conectadas nesta sessão; approvedTools é o que pode ser executado.",
          });
        },
      });
      localCtx.diagnose?.({
        source: "Copilot",
        operation: "tools disponíveis nesta pergunta",
        status: "catálogo",
        detail:
          tool.name +
          ". " +
          (tool.name === "mcp_query"
            ? "Modo MCP: custos reais só podem ser consultados se uma tool aprovada oferecer esses dados. pricing_get fornece preços, não gastos."
            : "Ferramentas mediadas pela aplicação; consulta de dados depende de chamada do modelo."),
      });
      emit({
        type: "context",
        requestId: ctx.requestId || "",
        runtime: "Copilot local (CLI; modelo remoto)",
        source: input.selection?.hubId
          ? "FinOps hub"
          : input.selection?.source === "mcp"
            ? "MCP · " +
              (await this.mcps!.get(input.selection.mcpConnectionId!)).name
            : "APIs Azure Cost Management",
        tools: [tool.name, catalogTool.name],
        scope: input.scope,
      });
      const allowedNames = [tool.name, catalogTool.name];
      session = await client.createSession(restrictedSessionConfig([tool, catalogTool]));
      unwatchUsage = session.on((event) => {
        if (event.type !== "assistant.usage") return;
        const { inputTokens: i, outputTokens: o } = event.data;
        if (typeof i === "number" && Number.isFinite(i) && i >= 0)
          inputTokens = (inputTokens || 0) + i;
        if (typeof o === "number" && Number.isFinite(o) && o >= 0)
          outputTokens = (outputTokens || 0) + o;
      });
      await session.rpc.tools.initializeAndValidate();
      const metadata = await session.rpc.tools.getCurrentMetadata();
      const items = (metadata as any).tools;
      if (
        !Array.isArray(items) ||
        items.some((x: any) => !allowedNames.includes(x.name)) ||
        !allowedNames.every((n) => items.some((x: any) => x.name === n))
      )
        throw new AppError(
          "forbidden",
          "O catálogo de ferramentas do Copilot não pôde ser restringido. Chat desativado.",
          403,
        );
      const activeSession = session;
      const onAbort = () => {
        void activeSession.abort().catch(() => {});
      };
      localCtx.signal.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => controller.abort(), 120000);
      try {
        emit({
          type: "progress",
          message:
            "Copilot analisando a pergunta; aguardando chamadas de tools…",
        });
        const response = await session.sendAndWait(
          {
            prompt: `Data atual: ${new Date().toISOString()}. Escopo autorizado: ${JSON.stringify(input.scope || null)}. Base: ${input.basis}. Pergunta: ${input.message}`,
          },
          120000,
        );
        assertActive(localCtx.signal);
        localCtx.diagnose?.({
          source: "Copilot",
          operation: "resposta concluída",
          status: "concluído",
          detail:
            calls +
            " interação(ões) com tools nesta pergunta. Se não houver evento de execução de leitura MCP/Azure, o modelo respondeu sem consultar esses dados.",
        });
        emit({
          type: "text",
          text: (
            response?.data.content || "Nenhuma resposta foi retornada."
          ).slice(0, 8000),
        });
      } finally {
        localCtx.signal.removeEventListener("abort", onAbort);
      }
    } finally {
      unwatchUsage?.();
      emit({
        type: "usage",
        inputTokens,
        outputTokens,
        toolCalls: calls,
        durationMs: Date.now() - started,
        provider: "GitHub Copilot",
      });
      unwatchHub?.();
      if (timer) clearTimeout(timer);
      controller.abort();
      ctx.signal.removeEventListener("abort", abort);
      this.busy.delete(ctx.sessionId);
      if (session && client) {
        const id = session.sessionId;
        await session.disconnect().catch(() => {});
        await client.deleteSession(id).catch(() => {});
      }
    }
  }
  async close() {
    await this.client?.stop();
  }
}

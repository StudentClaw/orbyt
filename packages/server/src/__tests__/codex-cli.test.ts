import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import type { ProviderRuntimeState } from "@student-claw/contracts"
import {
  buildCodexAppServerArgs,
  CodexCli,
  CodexCliLive,
  isReasoningItemType,
  mapCodexMcpToolCallCompletedEvent,
  mapCodexMcpToolCallProgressEvent,
  mapCodexMcpToolCallStartedEvent,
  normalizeAgentMessagePhase,
  shouldTreatAgentMessageAsReasoning,
} from "../ai/CodexCli.js"
import type { ProviderRuntimeStoreService } from "../ai/ProviderRuntimeStore.js"
import { ProviderRuntimeStore } from "../ai/ProviderRuntimeStore.js"
import { ConfigService } from "../config/ConfigService.js"
import { defaultConfig } from "../config/defaults.js"
import type { PluginGatewayService } from "../mcp/PluginGateway.js"
import { PluginGateway } from "../mcp/PluginGateway.js"

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "student-claw-codex-cli-"))
  tempDirs.push(dir)
  return dir
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function createProviderRuntimeStore(): ProviderRuntimeStoreService {
  let state: ProviderRuntimeState = {
    adapter: "codex" as const,
    status: "offline" as const,
    authState: "unknown" as const,
    lastError: null,
    queuedTurnCount: 0,
    lastUpdatedAt: new Date(0).toISOString(),
  }

  return {
    getState: async () => state,
    updateState: async (patch) => {
      state = {
        ...state,
        ...patch,
        lastUpdatedAt: new Date().toISOString(),
      }
      return state
    },
    getThreadSession: async () => null,
    upsertThreadSession: async () => undefined,
    enqueueTurn: async () => undefined,
    dequeueTurn: async () => undefined,
    listQueuedTurns: async () => [],
    refreshQueuedCount: async () => 0,
  }
}

function createPluginGatewayHarness(): {
  readonly service: PluginGatewayService
  readonly emitToolsChanged: () => Promise<void>
} {
  let listener: (() => void | Promise<void>) | null = null

  return {
    service: {
      getInventory: async () => ({
        revision: 1,
        observedAt: "2026-04-11T00:00:00.000Z",
        tools: [],
      }),
      callTool: async () => ({
        ok: false,
        exposedToolName: "template.template_ping",
        reason: "tool_not_available",
        message: "Not configured in this test harness.",
      }),
      subscribeToolsChanged: (next) => {
        listener = async () => {
          await next({
            type: "toolsChanged",
            snapshot: {
              revision: 2,
              observedAt: "2026-04-11T00:00:01.000Z",
              tools: [],
            },
          })
        }
        return () => {
          listener = null
        }
      },
      dispose: async () => undefined,
    },
    emitToolsChanged: async () => {
      await listener?.()
    },
  }
}

async function loadCodexCli(options: {
  readonly codexBinaryPath: string
  readonly logPath: string
  readonly pluginGatewayHarness: ReturnType<typeof createPluginGatewayHarness>
}) {
  const configLayer = Layer.succeed(ConfigService, {
    ...defaultConfig,
    wsAuthToken: "a".repeat(64),
    codexBinaryPath: options.codexBinaryPath,
    codexRequestTimeoutMs: 5_000,
    pluginGatewayMcpUrl: "http://127.0.0.1:8788/mcp",
    pluginGatewayMcpBearerToken: "gateway-secret",
    pluginGatewayMcpServerName: "student-claw",
  })

  const codexLayer = CodexCliLive.pipe(
    Layer.provideMerge(configLayer),
    Layer.provideMerge(Layer.succeed(PluginGateway, options.pluginGatewayHarness.service)),
    Layer.provideMerge(Layer.succeed(ProviderRuntimeStore, createProviderRuntimeStore())),
  )

  const codex = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* CodexCli
    }).pipe(Effect.provide(codexLayer)),
  )

  return {
    codex,
    readLogs: () =>
      readFileSync(options.logPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  }
}

function createFakeCodexBinary(logPath: string): string {
  const dir = createTempDir()
  const scriptPath = path.join(dir, "fake-codex.cjs")
  const script = `#!/usr/bin/env node
const fs = require("node:fs")
const readline = require("node:readline")
const log = (entry) => fs.appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(entry) + "\\n")
const args = process.argv.slice(2)

if (args[0] === "login" && args[1] === "status") {
  log({ type: "login-status" })
  process.stdout.write("Logged in\\n")
  process.exit(0)
}

if (args[0] === "app-server") {
  log({
    type: "start",
    args,
    gatewayToken: process.env.STUDENT_CLAW_GATEWAY_BEARER_TOKEN ?? null,
  })

  const rl = readline.createInterface({ input: process.stdin })
  rl.on("line", (line) => {
    if (!line.trim()) {
      return
    }

    const message = JSON.parse(line)
    if (!message.method) {
      return
    }

    log({ type: "request", method: message.method })

    if (message.method === "initialized") {
      return
    }

    const result = message.method === "account/read"
      ? { account: { type: "chatgpt" } }
      : {}

    process.stdout.write(JSON.stringify({ id: message.id, result }) + "\\n")
  })

  return
}

process.exit(1)
`

  writeFileSync(scriptPath, script, "utf8")
  chmodSync(scriptPath, 0o755)
  return scriptPath
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

describe("CodexCli gateway wiring", () => {
  test("classifies reasoning items and commentary phases separately from final answers", () => {
    expect(isReasoningItemType("reasoning")).toBe(true)
    expect(isReasoningItemType("thinking")).toBe(true)
    expect(isReasoningItemType("reasoningSummary")).toBe(true)
    expect(isReasoningItemType("reasoning_summary")).toBe(true)
    expect(isReasoningItemType("agentMessage")).toBe(false)

    expect(normalizeAgentMessagePhase("commentary")).toBe("commentary")
    expect(normalizeAgentMessagePhase("final_answer")).toBe("final_answer")
    expect(normalizeAgentMessagePhase(null)).toBe("unknown")
    expect(shouldTreatAgentMessageAsReasoning("commentary")).toBe(true)
    expect(shouldTreatAgentMessageAsReasoning("final_answer")).toBe(false)
    expect(shouldTreatAgentMessageAsReasoning(undefined)).toBe(false)
  })

  test("applies the fixed MCP gateway override at startup", () => {
    expect(buildCodexAppServerArgs({
      pluginGatewayMcpServerName: "student-claw",
      pluginGatewayMcpUrl: "http://127.0.0.1:8788/mcp",
    })).toEqual([
      "app-server",
      "-c",
      'mcp_servers."student-claw".url="http://127.0.0.1:8788/mcp"',
      "-c",
      'mcp_servers."student-claw".bearer_token_env_var="STUDENT_CLAW_GATEWAY_BEARER_TOKEN"',
    ])
  })

  test("maps Codex MCP tool-call notifications into normalized provider events", () => {
    const activeTurn = {
      localThreadId: "thread_1",
      localTurnId: "turn_1",
    }
    const snapshot = {
      itemId: "item_1",
      serverName: "student-claw",
      toolName: "template.template_ping",
      args: {},
    }

    const started = mapCodexMcpToolCallStartedEvent({
      item: {
        type: "mcpToolCall",
        id: "item_1",
        server: "student-claw",
        tool: "template.template_ping",
        arguments: {},
        status: "inProgress",
      },
    }, activeTurn)
    const progress = mapCodexMcpToolCallProgressEvent({
      itemId: "item_1",
      message: "Routing to plugin runtime",
    }, activeTurn, snapshot)
    const completed = mapCodexMcpToolCallCompletedEvent({
      item: {
        type: "mcpToolCall",
        id: "item_1",
        server: "student-claw",
        tool: "template.template_ping",
        arguments: {},
        status: "completed",
      },
    }, activeTurn, snapshot)
    const failed = mapCodexMcpToolCallCompletedEvent({
      item: {
        type: "mcpToolCall",
        id: "item_1",
        server: "student-claw",
        tool: "template.template_ping",
        arguments: {},
        status: "failed",
        error: {
          message: "Plugin template-mcp is not running.",
        },
      },
    }, activeTurn, snapshot)

    expect(started).toMatchObject({
      type: "provider.mcpToolCall",
      itemId: "item_1",
      serverName: "student-claw",
      toolName: "template.template_ping",
      args: {},
      status: "pending",
    })
    expect(String(started?.threadId)).toBe("thread_1")
    expect(String(started?.turnId)).toBe("turn_1")
    expect(progress).toMatchObject({
      type: "provider.mcpToolCall",
      itemId: "item_1",
      serverName: "student-claw",
      toolName: "template.template_ping",
      args: {},
      status: "pending",
      message: "Routing to plugin runtime",
    })
    expect(String(progress?.threadId)).toBe("thread_1")
    expect(String(progress?.turnId)).toBe("turn_1")
    expect(completed?.status).toBe("complete")
    expect(failed).toMatchObject({
      type: "provider.mcpToolCall",
      itemId: "item_1",
      serverName: "student-claw",
      toolName: "template.template_ping",
      args: {},
      status: "error",
      error: "Plugin template-mcp is not running.",
    })
    expect(String(failed?.threadId)).toBe("thread_1")
    expect(String(failed?.turnId)).toBe("turn_1")
  })

  test("reloads the already-registered gateway after toolsChanged", async () => {
    const tempDir = createTempDir()
    const logPath = path.join(tempDir, "codex.log")
    const fakeCodexBinary = createFakeCodexBinary(logPath)
    const pluginGatewayHarness = createPluginGatewayHarness()
    const { codex, readLogs } = await loadCodexCli({
      codexBinaryPath: fakeCodexBinary,
      logPath,
      pluginGatewayHarness,
    })

    try {
      await codex.initialize()
      await sleep(50)

      const startupLog = readLogs()
      const startEntry = startupLog.find((entry) => entry.type === "start")

      expect(startEntry).toBeDefined()
      expect(startEntry?.args).toEqual([
        "app-server",
        "-c",
        'mcp_servers."student-claw".url="http://127.0.0.1:8788/mcp"',
        "-c",
        'mcp_servers."student-claw".bearer_token_env_var="STUDENT_CLAW_GATEWAY_BEARER_TOKEN"',
      ])
      expect(startEntry?.gatewayToken).toBe("gateway-secret")

      await pluginGatewayHarness.emitToolsChanged()
      await sleep(50)

      const requestMethods = readLogs()
        .filter((entry) => entry.type === "request")
        .map((entry) => entry.method)

      expect(requestMethods).toContain("initialize")
      expect(requestMethods).toContain("account/read")
      expect(requestMethods).toContain("config/mcpServer/reload")
    } finally {
      await codex.shutdown()
    }
  })
})

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
  createCodexRuntimeInstance,
  isReasoningItemType,
  mapCodexMcpToolCallCompletedEvent,
  mapCodexMcpToolCallProgressEvent,
  mapCodexMcpToolCallStartedEvent,
  normalizeAgentMessagePhase,
  shouldTreatAgentMessageAsReasoning,
} from "../ai/CodexCli.js"
import type {
  ProviderRuntimeStoreService,
  QueuedProviderTurn,
  ThreadProviderSession,
} from "../ai/ProviderRuntimeStore.js"
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
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
  const threadSessions = new Map<string, ThreadProviderSession>()
  const queuedTurns = new Map<string, QueuedProviderTurn>()

  const refreshQueuedCount = async () => {
    state = {
      ...state,
      queuedTurnCount: queuedTurns.size,
      lastUpdatedAt: new Date().toISOString(),
    }
    return queuedTurns.size
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
    getThreadSession: async (threadId) => {
      const session = threadSessions.get(threadId) ?? null
      if (!session?.providerThreadId) {
        return session
      }

      const runtimePayload = session.runtimePayload
      if (isRecord(runtimePayload) && isRecord(runtimePayload.resumeCursor)) {
        return session
      }

      return {
        ...session,
        runtimePayload: {
          ...(isRecord(runtimePayload) ? runtimePayload : {}),
          resumeCursor: {
            threadId: session.providerThreadId,
          },
        },
      }
    },
    upsertThreadSession: async (threadId, patch) => {
      const current = threadSessions.get(threadId)
      const updatedAt = new Date().toISOString()
      threadSessions.set(threadId, {
        threadId,
        provider: "codex",
        status: patch.status ?? current?.status ?? state.status,
        lastError: patch.lastError === undefined ? current?.lastError ?? null : patch.lastError,
        updatedAt,
        providerThreadId:
          patch.providerThreadId === undefined
            ? current?.providerThreadId ?? null
            : patch.providerThreadId,
        authState: patch.authState ?? current?.authState ?? state.authState,
        runtimePayload:
          patch.runtimePayload === undefined
            ? current?.runtimePayload ?? null
            : patch.runtimePayload,
        cwd: patch.cwd === undefined ? current?.cwd ?? null : patch.cwd,
      })
    },
    enqueueTurn: async (turnId, threadId, content) => {
      const now = new Date().toISOString()
      queuedTurns.set(turnId, {
        turnId,
        threadId,
        content,
        createdAt: queuedTurns.get(turnId)?.createdAt ?? now,
        updatedAt: now,
      })
      await refreshQueuedCount()
    },
    dequeueTurn: async (turnId) => {
      queuedTurns.delete(turnId)
      await refreshQueuedCount()
    },
    listQueuedTurns: async () =>
      Array.from(queuedTurns.values()).sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.turnId.localeCompare(right.turnId),
      ),
    refreshQueuedCount,
    drain: async () => undefined,
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
  readonly codexRequestTimeoutMs?: number
  readonly runtimeStore?: ProviderRuntimeStoreService
}) {
  const configLayer = Layer.succeed(ConfigService, {
    ...defaultConfig,
    wsAuthToken: "a".repeat(64),
    codexBinaryPath: options.codexBinaryPath,
    codexRequestTimeoutMs: options.codexRequestTimeoutMs ?? 5_000,
    pluginGatewayMcpUrl: "http://127.0.0.1:8788/mcp",
    pluginGatewayMcpBearerToken: "gateway-secret",
    pluginGatewayMcpServerName: "student-claw",
  })

  const codexLayer = CodexCliLive.pipe(
    Layer.provideMerge(configLayer),
    Layer.provideMerge(Layer.succeed(PluginGateway, options.pluginGatewayHarness.service)),
    Layer.provideMerge(
      Layer.succeed(ProviderRuntimeStore, options.runtimeStore ?? createProviderRuntimeStore()),
    ),
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

function createFakeCodexBinary(
  logPath: string,
  options?: {
    readonly approvalCommand?: string
    readonly emitNotificationsBeforeTurnStartResponse?: boolean
    readonly threadResume?:
      | {
          readonly mode: "success"
          readonly threadId?: string
        }
      | {
          readonly mode: "recoverable-error" | "nonrecoverable-error"
          readonly message?: string
        }
  },
): string {
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
  const approvalCommand = ${JSON.stringify(options?.approvalCommand ?? null)}
  const emitNotificationsBeforeTurnStartResponse = ${JSON.stringify(
    options?.emitNotificationsBeforeTurnStartResponse ?? false,
  )}
  const threadResume = ${JSON.stringify(options?.threadResume ?? { mode: "success" })}
  let nextStartedThreadIndex = 1
  let nextTurnIndex = 1

  const rl = readline.createInterface({ input: process.stdin })
  rl.on("line", (line) => {
    if (!line.trim()) {
      return
    }

    const message = JSON.parse(line)
    const params =
      message.params && typeof message.params === "object" && !Array.isArray(message.params)
        ? message.params
        : {}
    if (!message.method) {
      log({ type: "response", id: message.id, result: message.result ?? null })
      return
    }

    log({ type: "request", method: message.method, params })

    if (message.method === "initialized") {
      return
    }

    if (message.method === "account/read") {
      process.stdout.write(JSON.stringify({ id: message.id, result: { account: { type: "chatgpt" } } }) + "\\n")
      return
    }

    if (message.method === "thread/start") {
      const providerThreadId = "provider_thread_" + String(nextStartedThreadIndex++)
      process.stdout.write(JSON.stringify({ id: message.id, result: { thread: { id: providerThreadId } } }) + "\\n")
      return
    }

    if (message.method === "thread/resume") {
      if (threadResume.mode === "recoverable-error" || threadResume.mode === "nonrecoverable-error") {
        process.stdout.write(JSON.stringify({
          id: message.id,
          error: {
            code: -32000,
            message:
              threadResume.message ??
              (threadResume.mode === "recoverable-error"
                ? "thread not found"
                : "thread/resume permission denied"),
          },
        }) + "\\n")
        return
      }

      const resumedThreadId =
        threadResume.threadId ??
        (typeof params.threadId === "string" && params.threadId.trim().length > 0
          ? params.threadId
          : "provider_thread_resumed")
      process.stdout.write(JSON.stringify({ id: message.id, result: { thread: { id: resumedThreadId } } }) + "\\n")
      return
    }

    if (message.method !== "turn/start") {
      process.stdout.write(JSON.stringify({ id: message.id, result: {} }) + "\\n")
      return
    }

    const providerThreadId =
      typeof params.threadId === "string" && params.threadId.trim().length > 0
        ? params.threadId
        : "provider_thread_unknown"
    const providerTurnId = "provider_turn_" + String(nextTurnIndex++)
    const result = { turn: { id: providerTurnId } }

    if (message.method === "turn/start" && emitNotificationsBeforeTurnStartResponse) {
      // Reproduce the race: flush the full notification stream for the turn
      // before sending the turn/start JSON-RPC response. Pre-registration
      // in streamTurn is required for these to be routed correctly.
      process.stdout.write(JSON.stringify({
        method: "turn/started",
        params: { threadId: providerThreadId, turnId: providerTurnId },
      }) + "\\n")
      process.stdout.write(JSON.stringify({
        method: "item/agentMessage/delta",
        params: {
          threadId: providerThreadId,
          turnId: providerTurnId,
          delta: "hello",
          itemId: "item_1",
        },
      }) + "\\n")
      process.stdout.write(JSON.stringify({
        method: "turn/completed",
        params: {
          threadId: providerThreadId,
          turn: { id: providerTurnId, status: "completed" },
        },
      }) + "\\n")
      setTimeout(() => {
        process.stdout.write(JSON.stringify({ id: message.id, result }) + "\\n")
      }, 20)
      return
    }

    process.stdout.write(JSON.stringify({ id: message.id, result }) + "\\n")

    if (message.method === "turn/start" && approvalCommand) {
      setTimeout(() => {
        process.stdout.write(JSON.stringify({
          id: "approval-1",
          method: "item/commandExecution/requestApproval",
          params: {
            threadId: providerThreadId,
            turnId: providerTurnId,
            command: approvalCommand,
            cwd: "/repo",
            availableDecisions: ["accept", "decline"],
          },
        }) + "\\n")
      }, 20)
    }
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

  test("starts a new provider thread once and reuses it for later turns in the same runtime", async () => {
    const tempDir = createTempDir()
    const logPath = path.join(tempDir, "codex.log")
    const runtimeStore = createProviderRuntimeStore()
    const fakeCodexBinary = createFakeCodexBinary(logPath)
    const pluginGatewayHarness = createPluginGatewayHarness()
    const { codex, readLogs } = await loadCodexCli({
      codexBinaryPath: fakeCodexBinary,
      logPath,
      pluginGatewayHarness,
      runtimeStore,
    })

    try {
      await codex.streamTurn({
        localThreadId: "thread_1",
        localTurnId: "turn_1",
        content: "First prompt",
        cwd: "/repo",
        onToken: async () => undefined,
        onReasoning: async () => undefined,
        onCompleted: async () => undefined,
        onInterrupted: async () => undefined,
        onError: async () => undefined,
        onMcpToolCall: async () => undefined,
        onApprovalRequest: async () => undefined,
      })
      await codex.streamTurn({
        localThreadId: "thread_1",
        localTurnId: "turn_2",
        content: "Second prompt",
        cwd: "/repo",
        onToken: async () => undefined,
        onReasoning: async () => undefined,
        onCompleted: async () => undefined,
        onInterrupted: async () => undefined,
        onError: async () => undefined,
        onMcpToolCall: async () => undefined,
        onApprovalRequest: async () => undefined,
      })
      await sleep(80)

      const requestMethods = readLogs()
        .filter((entry) => entry.type === "request")
        .map((entry) => entry.method)
        .filter((method) =>
          method === "thread/start" || method === "thread/resume" || method === "turn/start",
        )

      expect(requestMethods).toEqual([
        "thread/start",
        "turn/start",
        "turn/start",
      ])

      const session = await runtimeStore.getThreadSession("thread_1")
      expect(session?.providerThreadId).toBe("provider_thread_1")
      expect(session?.runtimePayload).toMatchObject({
        resumeCursor: {
          threadId: "provider_thread_1",
        },
      })
    } finally {
      await codex.shutdown()
    }
  })

  test("resumes a persisted provider thread when a cold runtime sends the next turn", async () => {
    const tempDir = createTempDir()
    const logPath = path.join(tempDir, "codex.log")
    const runtimeStore = createProviderRuntimeStore()
    const fakeCodexBinary = createFakeCodexBinary(logPath, {
      threadResume: {
        mode: "success",
        threadId: "provider_thread_resumed",
      },
    })
    const pluginGatewayHarness = createPluginGatewayHarness()

    const runtimeA = createCodexRuntimeInstance({
      config: {
        ...defaultConfig,
        wsAuthToken: "a".repeat(64),
        codexBinaryPath: fakeCodexBinary,
        codexRequestTimeoutMs: 5_000,
        pluginGatewayMcpUrl: "http://127.0.0.1:8788/mcp",
        pluginGatewayMcpBearerToken: "gateway-secret",
        pluginGatewayMcpServerName: "student-claw",
      },
      pluginGateway: pluginGatewayHarness.service,
      runtimeStore,
    })
    const runtimeB = createCodexRuntimeInstance({
      config: {
        ...defaultConfig,
        wsAuthToken: "a".repeat(64),
        codexBinaryPath: fakeCodexBinary,
        codexRequestTimeoutMs: 5_000,
        pluginGatewayMcpUrl: "http://127.0.0.1:8788/mcp",
        pluginGatewayMcpBearerToken: "gateway-secret",
        pluginGatewayMcpServerName: "student-claw",
      },
      pluginGateway: pluginGatewayHarness.service,
      runtimeStore,
    })

    try {
      await runtimeA.streamTurn({
        localThreadId: "thread_resume",
        localTurnId: "turn_1",
        content: "Seed context",
        cwd: "/repo",
        onToken: async () => undefined,
        onReasoning: async () => undefined,
        onCompleted: async () => undefined,
        onInterrupted: async () => undefined,
        onError: async () => undefined,
        onMcpToolCall: async () => undefined,
        onApprovalRequest: async () => undefined,
      })
      await sleep(50)
      await runtimeA.shutdown()

      await runtimeB.streamTurn({
        localThreadId: "thread_resume",
        localTurnId: "turn_2",
        content: "Continue from earlier context",
        cwd: "/repo",
        onToken: async () => undefined,
        onReasoning: async () => undefined,
        onCompleted: async () => undefined,
        onInterrupted: async () => undefined,
        onError: async () => undefined,
        onMcpToolCall: async () => undefined,
        onApprovalRequest: async () => undefined,
      })
      await sleep(80)

      const requestEntries = readFileSync(logPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .filter((entry) => entry.type === "request")
      const requestMethods = requestEntries
        .map((entry) => entry.method)
        .filter((method) =>
          method === "thread/start" || method === "thread/resume" || method === "turn/start",
        )

      expect(requestMethods).toEqual([
        "thread/start",
        "turn/start",
        "thread/resume",
        "turn/start",
      ])
      expect(requestEntries.find((entry) => entry.method === "thread/resume")?.params).toEqual(
        expect.objectContaining({
          threadId: "provider_thread_1",
          cwd: "/repo",
          model: defaultConfig.codexModel,
          approvalPolicy: expect.anything(),
          sandbox: expect.anything(),
        }),
      )

      const session = await runtimeStore.getThreadSession("thread_resume")
      expect(session?.providerThreadId).toBe("provider_thread_resumed")
      expect(session?.runtimePayload).toMatchObject({
        resumeCursor: {
          threadId: "provider_thread_resumed",
        },
      })
    } finally {
      await runtimeA.shutdown()
      await runtimeB.shutdown()
    }
  })

  test("derives a resume cursor from legacy provider-thread rows before resuming", async () => {
    const tempDir = createTempDir()
    const logPath = path.join(tempDir, "codex.log")
    const runtimeStore = createProviderRuntimeStore()
    const fakeCodexBinary = createFakeCodexBinary(logPath, {
      threadResume: {
        mode: "success",
        threadId: "provider_thread_normalized",
      },
    })
    const pluginGatewayHarness = createPluginGatewayHarness()

    await runtimeStore.upsertThreadSession("thread_legacy", {
      providerThreadId: "provider_thread_legacy",
      runtimePayload: null,
      status: "idle",
      authState: "authenticated",
      cwd: "/repo",
      lastError: null,
    })

    const runtime = createCodexRuntimeInstance({
      config: {
        ...defaultConfig,
        wsAuthToken: "a".repeat(64),
        codexBinaryPath: fakeCodexBinary,
        codexRequestTimeoutMs: 5_000,
        pluginGatewayMcpUrl: "http://127.0.0.1:8788/mcp",
        pluginGatewayMcpBearerToken: "gateway-secret",
        pluginGatewayMcpServerName: "student-claw",
      },
      pluginGateway: pluginGatewayHarness.service,
      runtimeStore,
    })

    try {
      await runtime.streamTurn({
        localThreadId: "thread_legacy",
        localTurnId: "turn_1",
        content: "Continue old thread",
        cwd: "/repo",
        onToken: async () => undefined,
        onReasoning: async () => undefined,
        onCompleted: async () => undefined,
        onInterrupted: async () => undefined,
        onError: async () => undefined,
        onMcpToolCall: async () => undefined,
        onApprovalRequest: async () => undefined,
      })
      await sleep(80)

      const requestEntries = readFileSync(logPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .filter((entry) => entry.type === "request")

      const requestMethods = requestEntries
        .map((entry) => entry.method)
        .filter((method) =>
          method === "thread/start" || method === "thread/resume" || method === "turn/start",
        )

      expect(requestMethods).toEqual([
        "thread/resume",
        "turn/start",
      ])
      expect(requestEntries.find((entry) => entry.method === "thread/resume")?.params).toEqual(
        expect.objectContaining({
          threadId: "provider_thread_legacy",
        }),
      )

      const session = await runtimeStore.getThreadSession("thread_legacy")
      expect(session?.providerThreadId).toBe("provider_thread_normalized")
      expect(session?.runtimePayload).toMatchObject({
        resumeCursor: {
          threadId: "provider_thread_normalized",
        },
      })
    } finally {
      await runtime.shutdown()
    }
  })

  test("falls back to a fresh provider thread after a recoverable thread/resume failure", async () => {
    const tempDir = createTempDir()
    const logPath = path.join(tempDir, "codex.log")
    const runtimeStore = createProviderRuntimeStore()
    const fakeCodexBinary = createFakeCodexBinary(logPath, {
      threadResume: {
        mode: "recoverable-error",
        message: "thread not found",
      },
    })
    const pluginGatewayHarness = createPluginGatewayHarness()

    const runtimeA = createCodexRuntimeInstance({
      config: {
        ...defaultConfig,
        wsAuthToken: "a".repeat(64),
        codexBinaryPath: fakeCodexBinary,
        codexRequestTimeoutMs: 5_000,
        pluginGatewayMcpUrl: "http://127.0.0.1:8788/mcp",
        pluginGatewayMcpBearerToken: "gateway-secret",
        pluginGatewayMcpServerName: "student-claw",
      },
      pluginGateway: pluginGatewayHarness.service,
      runtimeStore,
    })
    const runtimeB = createCodexRuntimeInstance({
      config: {
        ...defaultConfig,
        wsAuthToken: "a".repeat(64),
        codexBinaryPath: fakeCodexBinary,
        codexRequestTimeoutMs: 5_000,
        pluginGatewayMcpUrl: "http://127.0.0.1:8788/mcp",
        pluginGatewayMcpBearerToken: "gateway-secret",
        pluginGatewayMcpServerName: "student-claw",
      },
      pluginGateway: pluginGatewayHarness.service,
      runtimeStore,
    })

    try {
      await runtimeA.streamTurn({
        localThreadId: "thread_fallback",
        localTurnId: "turn_1",
        content: "Seed context",
        cwd: "/repo",
        onToken: async () => undefined,
        onReasoning: async () => undefined,
        onCompleted: async () => undefined,
        onInterrupted: async () => undefined,
        onError: async () => undefined,
        onMcpToolCall: async () => undefined,
        onApprovalRequest: async () => undefined,
      })
      await sleep(50)
      await runtimeA.shutdown()

      await runtimeB.streamTurn({
        localThreadId: "thread_fallback",
        localTurnId: "turn_2",
        content: "Continue after fallback",
        cwd: "/repo",
        onToken: async () => undefined,
        onReasoning: async () => undefined,
        onCompleted: async () => undefined,
        onInterrupted: async () => undefined,
        onError: async () => undefined,
        onMcpToolCall: async () => undefined,
        onApprovalRequest: async () => undefined,
      })
      await sleep(80)

      const requestMethods = readFileSync(logPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .filter((entry) => entry.type === "request")
        .map((entry) => entry.method)
        .filter((method) =>
          method === "thread/start" || method === "thread/resume" || method === "turn/start",
        )

      expect(requestMethods).toEqual([
        "thread/start",
        "turn/start",
        "thread/resume",
        "thread/start",
        "turn/start",
      ])

      const session = await runtimeStore.getThreadSession("thread_fallback")
      expect(session?.providerThreadId).toBe("provider_thread_1")
      expect(session?.runtimePayload).toMatchObject({
        resumeCursor: {
          threadId: "provider_thread_1",
        },
      })
    } finally {
      await runtimeA.shutdown()
      await runtimeB.shutdown()
    }
  })

  test("surfaces non-recoverable thread/resume failures without starting a fresh thread", async () => {
    const tempDir = createTempDir()
    const logPath = path.join(tempDir, "codex.log")
    const runtimeStore = createProviderRuntimeStore()
    const fakeCodexBinary = createFakeCodexBinary(logPath, {
      threadResume: {
        mode: "nonrecoverable-error",
        message: "thread/resume permission denied",
      },
    })
    const pluginGatewayHarness = createPluginGatewayHarness()

    const runtimeA = createCodexRuntimeInstance({
      config: {
        ...defaultConfig,
        wsAuthToken: "a".repeat(64),
        codexBinaryPath: fakeCodexBinary,
        codexRequestTimeoutMs: 5_000,
        pluginGatewayMcpUrl: "http://127.0.0.1:8788/mcp",
        pluginGatewayMcpBearerToken: "gateway-secret",
        pluginGatewayMcpServerName: "student-claw",
      },
      pluginGateway: pluginGatewayHarness.service,
      runtimeStore,
    })
    const runtimeB = createCodexRuntimeInstance({
      config: {
        ...defaultConfig,
        wsAuthToken: "a".repeat(64),
        codexBinaryPath: fakeCodexBinary,
        codexRequestTimeoutMs: 5_000,
        pluginGatewayMcpUrl: "http://127.0.0.1:8788/mcp",
        pluginGatewayMcpBearerToken: "gateway-secret",
        pluginGatewayMcpServerName: "student-claw",
      },
      pluginGateway: pluginGatewayHarness.service,
      runtimeStore,
    })

    try {
      await runtimeA.streamTurn({
        localThreadId: "thread_fail",
        localTurnId: "turn_1",
        content: "Seed context",
        cwd: "/repo",
        onToken: async () => undefined,
        onReasoning: async () => undefined,
        onCompleted: async () => undefined,
        onInterrupted: async () => undefined,
        onError: async () => undefined,
        onMcpToolCall: async () => undefined,
        onApprovalRequest: async () => undefined,
      })
      await sleep(50)
      await runtimeA.shutdown()

      await expect(
        runtimeB.streamTurn({
          localThreadId: "thread_fail",
          localTurnId: "turn_2",
          content: "Continue after forbidden resume",
          cwd: "/repo",
          onToken: async () => undefined,
          onReasoning: async () => undefined,
          onCompleted: async () => undefined,
          onInterrupted: async () => undefined,
          onError: async () => undefined,
          onMcpToolCall: async () => undefined,
          onApprovalRequest: async () => undefined,
        }),
      ).rejects.toThrow(/thread\/resume permission denied/i)
      await sleep(50)

      const requestMethods = readFileSync(logPath, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .filter((entry) => entry.type === "request")
        .map((entry) => entry.method)
        .filter((method) =>
          method === "thread/start" || method === "thread/resume" || method === "turn/start",
        )

      expect(requestMethods).toEqual([
        "thread/start",
        "turn/start",
        "thread/resume",
      ])

      const session = await runtimeStore.getThreadSession("thread_fail")
      expect(session?.providerThreadId).toBe("provider_thread_1")
      expect(session?.runtimePayload).toMatchObject({
        resumeCursor: {
          threadId: "provider_thread_1",
        },
      })
    } finally {
      await runtimeA.shutdown()
      await runtimeB.shutdown()
    }
  })

  test("auto-approves balanced safe commands without surfacing an approval card", async () => {
    const tempDir = createTempDir()
    const logPath = path.join(tempDir, "codex.log")
    const fakeCodexBinary = createFakeCodexBinary(logPath, {
      approvalCommand: "bun run build",
    })
    const pluginGatewayHarness = createPluginGatewayHarness()
    const { codex, readLogs } = await loadCodexCli({
      codexBinaryPath: fakeCodexBinary,
      logPath,
      pluginGatewayHarness,
    })

    const approvals: string[] = []

    try {
      await codex.streamTurn({
        localThreadId: "thread_1",
        localTurnId: "turn_1",
        content: "Run the project checks",
        cwd: "/repo",
        onToken: async () => undefined,
        onReasoning: async () => undefined,
        onCompleted: async () => undefined,
        onInterrupted: async () => undefined,
        onError: async () => undefined,
        onMcpToolCall: async () => undefined,
        onApprovalRequest: async (approval) => {
          approvals.push(approval.command ?? "")
        },
      })
      await sleep(100)

      expect(approvals).toEqual([])
      expect(readLogs()).toContainEqual({
        type: "response",
        id: "approval-1",
        result: { decision: "accept" },
      })
    } finally {
      await codex.shutdown()
    }
  })

  test("auto-approves safe shell-wrapped inspection commands", async () => {
    const tempDir = createTempDir()
    const logPath = path.join(tempDir, "codex.log")
    const fakeCodexBinary = createFakeCodexBinary(logPath, {
      approvalCommand: "/bin/zsh -lc \"pdftotext 'Math 26/26old_exams2_S26.pdf' - | sed -n '240,520p'\"",
    })
    const pluginGatewayHarness = createPluginGatewayHarness()
    const { codex, readLogs } = await loadCodexCli({
      codexBinaryPath: fakeCodexBinary,
      logPath,
      pluginGatewayHarness,
    })

    const approvals: string[] = []

    try {
      await codex.streamTurn({
        localThreadId: "thread_1",
        localTurnId: "turn_1",
        content: "Inspect the PDF contents",
        cwd: "/repo",
        onToken: async () => undefined,
        onReasoning: async () => undefined,
        onCompleted: async () => undefined,
        onInterrupted: async () => undefined,
        onError: async () => undefined,
        onMcpToolCall: async () => undefined,
        onApprovalRequest: async (approval) => {
          approvals.push(approval.command ?? "")
        },
      })
      await sleep(100)

      expect(approvals).toEqual([])
      expect(readLogs()).toContainEqual({
        type: "response",
        id: "approval-1",
        result: { decision: "accept" },
      })
    } finally {
      await codex.shutdown()
    }
  })

  test("keeps pending approvals isolated per runtime instance", async () => {
    const tempDir = createTempDir()
    const logPath = path.join(tempDir, "codex.log")
    const fakeCodexBinary = createFakeCodexBinary(logPath, {
      approvalCommand: "rm -rf ./tmp",
    })
    const pluginGatewayHarness = createPluginGatewayHarness()
    const runtimeA = createCodexRuntimeInstance({
      config: {
        ...defaultConfig,
        wsAuthToken: "a".repeat(64),
        codexBinaryPath: fakeCodexBinary,
        codexRequestTimeoutMs: 5_000,
        pluginGatewayMcpUrl: "http://127.0.0.1:8788/mcp",
        pluginGatewayMcpBearerToken: "gateway-secret",
        pluginGatewayMcpServerName: "student-claw",
      },
      pluginGateway: pluginGatewayHarness.service,
      runtimeStore: createProviderRuntimeStore(),
    })
    const runtimeB = createCodexRuntimeInstance({
      config: {
        ...defaultConfig,
        wsAuthToken: "a".repeat(64),
        codexBinaryPath: fakeCodexBinary,
        codexRequestTimeoutMs: 5_000,
        pluginGatewayMcpUrl: "http://127.0.0.1:8788/mcp",
        pluginGatewayMcpBearerToken: "gateway-secret",
        pluginGatewayMcpServerName: "student-claw",
      },
      pluginGateway: pluginGatewayHarness.service,
      runtimeStore: createProviderRuntimeStore(),
    })

    try {
      await runtimeA.streamTurn({
        localThreadId: "thread_A",
        localTurnId: "turn_A",
        content: "Do the first thing",
        cwd: "/repo-a",
        onToken: async () => undefined,
        onReasoning: async () => undefined,
        onCompleted: async () => undefined,
        onInterrupted: async () => undefined,
        onError: async () => undefined,
        onMcpToolCall: async () => undefined,
        onApprovalRequest: async () => undefined,
      })

      await runtimeB.streamTurn({
        localThreadId: "thread_B",
        localTurnId: "turn_B",
        content: "Do the second thing",
        cwd: "/repo-b",
        onToken: async () => undefined,
        onReasoning: async () => undefined,
        onCompleted: async () => undefined,
        onInterrupted: async () => undefined,
        onError: async () => undefined,
        onMcpToolCall: async () => undefined,
        onApprovalRequest: async () => undefined,
      })

      await sleep(80)

      const approvalsA = runtimeA.listPendingApprovals()
      const approvalsB = runtimeB.listPendingApprovals()

      expect(approvalsA).toHaveLength(1)
      expect(approvalsB).toHaveLength(1)
      expect(String(approvalsA[0]?.threadId)).toBe("thread_A")
      expect(String(approvalsA[0]?.turnId)).toBe("turn_A")
      expect(String(approvalsB[0]?.threadId)).toBe("thread_B")
      expect(String(approvalsB[0]?.turnId)).toBe("turn_B")
    } finally {
      await runtimeA.shutdown()
      await runtimeB.shutdown()
      // fall through to the outer finally below
    }
  })

  test("routes notifications that arrive before the turn/start response", async () => {
    const tempDir = createTempDir()
    const logPath = path.join(tempDir, "codex.log")
    const fakeCodexBinary = createFakeCodexBinary(logPath, {
      emitNotificationsBeforeTurnStartResponse: true,
    })
    const pluginGatewayHarness = createPluginGatewayHarness()
    const { codex } = await loadCodexCli({
      codexBinaryPath: fakeCodexBinary,
      logPath,
      pluginGatewayHarness,
    })

    const tokens: string[] = []
    let completed = false

    try {
      await codex.streamTurn({
        localThreadId: "thread_race",
        localTurnId: "turn_race",
        content: "Say hi",
        cwd: "/repo",
        onToken: async (token) => {
          tokens.push(token)
        },
        onReasoning: async () => undefined,
        onCompleted: async () => {
          completed = true
        },
        onInterrupted: async () => undefined,
        onError: async () => undefined,
        onMcpToolCall: async () => undefined,
        onApprovalRequest: async () => undefined,
      })
      // The notification stream was flushed before the turn/start response
      // returned. Pre-registration must ensure the delta and completion land
      // on the correct active turn, otherwise the turn appears stuck.
      await sleep(80)

      expect(tokens.join("")).toBe("hello")
      expect(completed).toBe(true)
    } finally {
      await codex.shutdown()
    }
  })
})

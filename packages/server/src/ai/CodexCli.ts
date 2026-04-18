import { Context, Effect, Layer } from "effect"
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process"
import readline from "node:readline"
import {
  shouldAutoApproveShellCommand,
  type ProviderApprovalDecision,
  type ThreadAccessMode,
} from "@student-claw/contracts"
import { ConfigService } from "../config/ConfigService.js"
import type { AppConfig } from "../config/defaults.js"
import { PluginGateway } from "../mcp/PluginGateway.js"
import type { PluginGatewayService } from "../mcp/PluginGateway.js"
import { ProviderRuntimeStore, type ProviderRuntimeStoreService } from "./ProviderRuntimeStore.js"
import {
  ActiveTurn,
  PendingApprovalEntry,
  ProviderMcpToolCallEvent,
  ProviderRuntimeFailure,
  STUDENT_CLAW_GATEWAY_TOKEN_ENV,
  buildCodexAppServerArgs,
  buildInitializeParams,
  emitReasoningText,
  emitTextByPhase,
  findActiveTurnByProviderIds,
  getThreadStartPolicy,
  isRecord,
  mapCodexMcpToolCallCompletedEvent,
  mapCodexMcpToolCallProgressEvent,
  mapCodexMcpToolCallStartedEvent,
  mapPendingApprovalEntry,
  normalizeSessionCwd,
  readAgentMessageState,
  readAuthFailure,
  readErrorMessage,
  readReasoningItemState,
  readString,
} from "./CodexEventParser.js"

// Re-export public API for backward compatibility
export {
  ProviderRuntimeFailure,
  buildCodexAppServerArgs,
  isReasoningItemType,
  mapCodexMcpToolCallCompletedEvent,
  mapCodexMcpToolCallProgressEvent,
  mapCodexMcpToolCallStartedEvent,
  normalizeAgentMessagePhase,
  shouldTreatAgentMessageAsReasoning,
} from "./CodexEventParser.js"

// ============================================================================
// Local types (only used within the live layer)
// ============================================================================

type PendingRequest = {
  readonly timeout: ReturnType<typeof setTimeout>
  readonly resolve: (value: unknown) => void
  readonly reject: (error: Error) => void
}

type ThreadStartResponse = {
  readonly thread?: {
    readonly id?: string
  }
}

type TurnStartResponse = {
  readonly turn?: {
    readonly id?: string
  }
}

type AccountReadResponse = {
  readonly account?: {
    readonly type?: string
  }
  readonly requiresOpenaiAuth?: boolean
}

type JsonRpcMessage =
  | { id?: string | number; result?: unknown; error?: { code?: number; message?: string } }
  | { id?: string | number; method?: string; params?: unknown }

// ============================================================================
// Service interface and tag
// ============================================================================

export interface CodexCliService {
  readonly initialize: () => Promise<void>
  readonly retryInitialize: () => Promise<boolean>
  readonly startAuth: () => Promise<boolean>
  readonly reloadGatewayTools: () => Promise<boolean>
  readonly streamTurn: (input: {
    localThreadId: string
    localTurnId: string
    content: string
    cwd?: string | null
    accessMode?: ThreadAccessMode
    model?: string | null
    onToken: (token: string, index: number) => Promise<void>
    onReasoning: (token: string, index: number) => Promise<void>
    onCompleted: () => Promise<void>
    onInterrupted: () => Promise<void>
    onError: (error: ProviderRuntimeFailure) => Promise<void>
    onMcpToolCall: (event: ProviderMcpToolCallEvent) => Promise<void>
    onApprovalRequest: (approval: import("@student-claw/contracts").ProviderPendingApproval) => Promise<void>
  }) => Promise<void>
  readonly listPendingApprovals: () => ReadonlyArray<import("@student-claw/contracts").ProviderPendingApproval>
  readonly respondToApproval: (
    approvalRequestId: string,
    decision: ProviderApprovalDecision,
  ) => Promise<{
    approvalRequestId: string
    threadId: string
    turnId: string
    decision: ProviderApprovalDecision
    resolved: boolean
  }>
  readonly interruptTurn: (localThreadId: string, localTurnId: string) => Promise<boolean>
  readonly shutdown: () => Promise<void>
}

export class CodexCli extends Context.Tag("CodexCli")<CodexCli, CodexCliService>() {}

// ============================================================================
// Live layer
// ============================================================================

type CodexRuntimeInstanceDeps = {
  readonly config: AppConfig
  readonly pluginGateway: PluginGatewayService
  readonly runtimeStore: ProviderRuntimeStoreService
}

export function createCodexRuntimeInstance(
  { config, pluginGateway, runtimeStore }: CodexRuntimeInstanceDeps,
): CodexCliService {
  const binaryPath = config.codexBinaryPath
  const homePath = config.codexHomePath
  const processHomePath = config.codexProcessHomePath
  const providerThreadIds = new Map<string, string>()
  const activeProviderTurns = new Map<string, ActiveTurn>()
  const pendingApprovalRequests = new Map<string, PendingApprovalEntry>()
  let child: ChildProcessWithoutNullStreams | null = null
  let output: readline.Interface | null = null
  let pending = new Map<string, PendingRequest>()
  let nextRequestId = 1
  let initPromise: Promise<void> | null = null
  let initialized = false
  let shuttingDown = false

  const cleanupProcess = async (failure?: ProviderRuntimeFailure) => {
    const currentChild = child
    const currentOutput = output
    child = null
    output = null
    initPromise = null
    initialized = false

    for (const entry of pending.values()) {
      clearTimeout(entry.timeout)
      entry.reject(
        failure
        ?? new ProviderRuntimeFailure(
          "codex_process_closed",
          "Codex app-server stopped unexpectedly.",
          true,
        ),
      )
    }
    pending = new Map()
    pendingApprovalRequests.clear()

    if (currentOutput) {
      currentOutput.removeAllListeners()
      currentOutput.close()
    }

    if (currentChild && !currentChild.killed) {
      currentChild.kill()
    }
  }

  const reloadGatewayTools = async (): Promise<boolean> => {
    if (!child?.stdin.writable || !initialized || !config.pluginGatewayMcpUrl) {
      return false
    }

    await sendRequest("config/mcpServer/reload", undefined)
    return true
  }

  const failActiveTurns = async (failure: ProviderRuntimeFailure) => {
    const activeTurns = Array.from(activeProviderTurns.values())
    activeProviderTurns.clear()
    for (const turn of activeTurns) {
      await turn.onError(failure)
    }
  }

  const updateFailureState = async (failure: ProviderRuntimeFailure) => {
    await runtimeStore.updateState({
      status:
        failure.code === "codex_auth_required"
          ? "auth_required"
          : failure.code === "codex_rate_limited"
            ? "rate_limited"
            : "degraded",
      authState: failure.code === "codex_auth_required" ? "auth_required" : undefined,
      lastError: {
        code: failure.code,
        message: failure.message,
      },
    })
  }

  const ensureAuthenticated = async (): Promise<void> => {
    const result = spawnSync(binaryPath, ["login", "status"], {
      env: {
        ...process.env,
        ...(homePath ? { CODEX_HOME: homePath } : {}),
        ...(processHomePath ? { HOME: processHomePath } : {}),
      },
      encoding: "utf8",
    })

    const authFailure = readAuthFailure(result.stdout ?? "", result.stderr ?? "")
    if (authFailure) {
      await updateFailureState(authFailure)
      throw authFailure
    }
  }

  const sendRequest = async <T>(method: string, params: unknown): Promise<T> => {
    const isHandshakeMethod = method === "initialize" || method === "account/read"
    if (!child?.stdin.writable && !isHandshakeMethod) {
      await initialize()
    }

    if (!child?.stdin.writable) {
      throw new ProviderRuntimeFailure(
        "codex_process_unavailable",
        "Codex app-server is not available.",
        true,
      )
    }

    const id = String(nextRequestId++)
    const promise = new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id)
        reject(
          new ProviderRuntimeFailure(
            "codex_request_timeout",
            `Timed out waiting for Codex response to ${method}.`,
            true,
          ),
        )
      }, config.codexRequestTimeoutMs)

      pending.set(id, {
        timeout,
        resolve: (value) => resolve(value as T),
        reject,
      })
    })

    child.stdin.write(`${JSON.stringify({ id, method, params })}\n`)
    return promise
  }

  const writeMessage = (payload: unknown): void => {
    if (!child?.stdin.writable) {
      throw new ProviderRuntimeFailure(
        "codex_process_unavailable",
        "Codex app-server is not available.",
        true,
      )
    }

    child.stdin.write(`${JSON.stringify(payload)}\n`)
  }

  const clearPendingApprovalsForTurn = (localTurnId: string): void => {
    for (const [approvalRequestId, entry] of pendingApprovalRequests.entries()) {
      if (entry.approval.turnId === localTurnId) {
        pendingApprovalRequests.delete(approvalRequestId)
      }
    }
  }

  const handleServerRequest = async (message: JsonRpcMessage): Promise<void> => {
    const method =
      "method" in message && typeof message.method === "string" ? message.method : null
    if (!method || !("id" in message) || message.id == null) {
      return
    }

    if (
      method !== "item/commandExecution/requestApproval"
      && method !== "item/fileChange/requestApproval"
      && method !== "item/permissions/requestApproval"
    ) {
      writeMessage({
        id: message.id,
        error: {
          code: -32601,
          message: `Unsupported server request: ${method}`,
        },
      })
      return
    }

    const params = "params" in message ? message.params : null
    const providerThreadId = readString(params, "threadId") ?? null
    const providerTurnId = readString(params, "turnId") ?? null
    const activeTurn = findActiveTurnByProviderIds(
      activeProviderTurns,
      providerThreadId,
      providerTurnId,
    )

    if (!activeTurn) {
      const denialResult =
        method === "item/permissions/requestApproval"
          ? { permissions: {}, scope: "turn" }
          : { decision: "decline" }
      writeMessage({
        id: message.id,
        result: denialResult,
      })
      return
    }

    if (
      method === "item/commandExecution/requestApproval"
      && shouldAutoApproveShellCommand(readString(params, "command") ?? null)
    ) {
      writeMessage({
        id: message.id,
        result: { decision: "accept" },
      })
      return
    }

    const entry = mapPendingApprovalEntry(message.id, method, params, activeTurn)
    pendingApprovalRequests.set(entry.approval.id, entry)
    await activeTurn.onApprovalRequest(entry.approval)
  }

  const handleNotification = async (message: JsonRpcMessage) => {
    const method =
      "method" in message && typeof message.method === "string" ? message.method : null
    if (!method) return

    if (method === "account/rateLimits/updated") {
      const params =
        "params" in message && isRecord(message.params) ? message.params : null
      const rateLimits = params ? params.rateLimits : null
      const primary = isRecord(rateLimits) ? rateLimits.primary : null
      const usedPercent = isRecord(primary) ? primary.usedPercent : null
      if (typeof usedPercent === "number" && usedPercent >= 100) {
        await runtimeStore.updateState({
          status: "rate_limited",
          lastError: {
            code: "codex_rate_limited",
            message: "Codex rate limit reached. Retry later.",
          },
        })
      }
      return
    }

    const params = "params" in message && isRecord(message.params) ? message.params : null
    const providerThreadId = readString(params, "threadId")
    const turn = params && isRecord(params.turn) ? params.turn : null
    const providerTurnId = readString(turn, "id") ?? readString(params, "turnId")

    if (method === "turn/started" && providerTurnId) {
      const activeTurn = Array.from(activeProviderTurns.values()).find(
        (entry) =>
          entry.providerThreadId === providerThreadId && entry.providerTurnId === null,
      )
      if (activeTurn) {
        activeTurn.providerTurnId = providerTurnId
      }
      return
    }

    const activeTurn = findActiveTurnByProviderIds(
      activeProviderTurns,
      providerThreadId ?? null,
      providerTurnId ?? null,
    )
    if (!activeTurn) return

    if (method === "item/started") {
      const agentMessage = readAgentMessageState(params)
      if (agentMessage.itemId) {
        activeTurn.agentMessagePhases.set(agentMessage.itemId, agentMessage.phase)
      }

      const reasoningItem = readReasoningItemState(params)
      if (reasoningItem.reasoningState) {
        return
      }

      const event = mapCodexMcpToolCallStartedEvent(params, activeTurn)
      if (!event) {
        return
      }

      activeTurn.mcpToolCalls.set(event.itemId, {
        itemId: event.itemId,
        serverName: event.serverName,
        toolName: event.toolName,
        args: event.args,
      })
      await activeTurn.onMcpToolCall(event)
      return
    }

    if (
      method === "item/reasoning/textDelta"
      || method === "item/reasoning/summaryTextDelta"
    ) {
      const itemId = readString(params, "itemId") ?? null
      const delta = readString(params, "delta")
      if (!delta) {
        return
      }

      await emitReasoningText(activeTurn, itemId, delta)
      return
    }

    if (method === "item/mcpToolCall/progress") {
      const itemId = readString(params, "itemId")
      const event = mapCodexMcpToolCallProgressEvent(
        params,
        activeTurn,
        itemId ? activeTurn.mcpToolCalls.get(itemId) : undefined,
      )
      if (event) {
        await activeTurn.onMcpToolCall(event)
      }
      return
    }

    if (method === "item/agentMessage/delta") {
      const delta = readString(params, "delta")
      const itemId = readString(params, "itemId") ?? null
      if (!delta) {
        return
      }

      const phase = itemId
        ? (activeTurn.agentMessagePhases.get(itemId) ?? "unknown")
        : "unknown"
      await emitTextByPhase(activeTurn, itemId, delta, phase)
      return
    }

    if (method === "item/completed") {
      const agentMessage = readAgentMessageState(params)
      if (agentMessage.itemId && agentMessage.text) {
        const emittedLength = activeTurn.emittedTextLengths.get(agentMessage.itemId) ?? 0
        const remainingText = agentMessage.text.slice(emittedLength)
        await emitTextByPhase(
          activeTurn,
          agentMessage.itemId,
          remainingText,
          agentMessage.phase,
        )
        activeTurn.agentMessagePhases.delete(agentMessage.itemId)
        activeTurn.emittedTextLengths.delete(agentMessage.itemId)
      }

      const reasoningItem = readReasoningItemState(params)
      if (reasoningItem.itemId && reasoningItem.text) {
        const emittedLength =
          activeTurn.emittedTextLengths.get(reasoningItem.itemId) ?? 0
        const remainingText = reasoningItem.text.slice(emittedLength)
        await emitReasoningText(activeTurn, reasoningItem.itemId, remainingText)
        activeTurn.emittedTextLengths.delete(reasoningItem.itemId)
      }

      const itemId = agentMessage.itemId ?? reasoningItem.itemId ?? undefined
      if (itemId) {
        activeTurn.agentMessagePhases.delete(itemId)
      }
      const event = mapCodexMcpToolCallCompletedEvent(
        params,
        activeTurn,
        itemId ? activeTurn.mcpToolCalls.get(itemId) : undefined,
      )
      if (event) {
        if (event.status !== "pending") {
          activeTurn.mcpToolCalls.delete(event.itemId)
        }
        await activeTurn.onMcpToolCall(event)
      }
      return
    }

    if (method === "turn/completed") {
      const resolvedProviderTurnId = activeTurn.providerTurnId ?? providerTurnId
      if (!resolvedProviderTurnId) {
        return
      }
      activeProviderTurns.delete(resolvedProviderTurnId)
      clearPendingApprovalsForTurn(activeTurn.localTurnId)
      await runtimeStore.updateState({
        status: "idle",
        lastError: null,
      })
      const status = readString(turn, "status")
      if (status === "interrupted") {
        await activeTurn.onInterrupted()
        return
      }
      await activeTurn.onCompleted()
    }
  }

  const attachListeners = () => {
    if (!child) return
    output = readline.createInterface({ input: child.stdout })

    output.on("line", (line) => {
      if (!line.trim()) return

      let parsed: JsonRpcMessage
      try {
        parsed = JSON.parse(line) as JsonRpcMessage
      } catch {
        return
      }

      if ("method" in parsed && typeof parsed.method === "string") {
        if ("id" in parsed && parsed.id != null) {
          void handleServerRequest(parsed)
          return
        }

        void handleNotification(parsed)
        return
      }

      if ("id" in parsed && parsed.id != null) {
        const entry = pending.get(String(parsed.id))
        if (!entry) return
        clearTimeout(entry.timeout)
        pending.delete(String(parsed.id))
        const errorMessage = readErrorMessage(parsed)
        if (errorMessage) {
          entry.reject(
            new ProviderRuntimeFailure(
              "codex_request_failed",
              errorMessage,
              !errorMessage.toLowerCase().includes("auth"),
            ),
          )
          return
        }
        entry.resolve("result" in parsed ? parsed.result : undefined)
        return
      }
    })

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString()
      if (text.toLowerCase().includes("rate limit")) {
        void updateFailureState(
          new ProviderRuntimeFailure(
            "codex_rate_limited",
            "Codex rate limit reached. Retry later.",
            true,
          ),
        )
      }
    })

    child.on("error", (error) => {
      if (shuttingDown) {
        return
      }
      const failure = new ProviderRuntimeFailure(
        "codex_process_error",
        error.message || "Codex app-server failed.",
        true,
      )
      void updateFailureState(failure)
      void failActiveTurns(failure)
      void cleanupProcess(failure)
    })

    child.on("exit", (code, signal) => {
      if (shuttingDown) {
        return
      }

      if (pending.size === 0 && activeProviderTurns.size === 0) {
        void cleanupProcess()
        void runtimeStore.updateState({
          status: "idle",
          authState: "authenticated",
          lastError: null,
        })
        return
      }

      const failure = new ProviderRuntimeFailure(
        "codex_process_exited",
        `Codex app-server exited unexpectedly (code=${code ?? "null"}, signal=${signal ?? "null"}).`,
        true,
      )
      void updateFailureState(failure)
      void failActiveTurns(failure)
      void cleanupProcess(failure)
    })
  }

  const initialize = async (): Promise<void> => {
    if (initPromise) {
      return initPromise
    }

    initPromise = (async () => {
      await runtimeStore.updateState({
        status: "initializing",
        lastError: null,
      })

      await ensureAuthenticated()
      await pluginGateway.getInventory().catch(() => undefined)

      const appServerArgs = buildCodexAppServerArgs(config)

      child = spawn(binaryPath, appServerArgs, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...(homePath ? { CODEX_HOME: homePath } : {}),
          ...(processHomePath ? { HOME: processHomePath } : {}),
          ...(config.pluginGatewayMcpBearerToken
            ? { [STUDENT_CLAW_GATEWAY_TOKEN_ENV]: config.pluginGatewayMcpBearerToken }
            : {}),
        },
        stdio: ["pipe", "pipe", "pipe"],
        shell: process.platform === "win32",
      })
      attachListeners()

      await sendRequest("initialize", buildInitializeParams())
      child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`)

      const account = await sendRequest<AccountReadResponse>("account/read", {})
      const accountType = account.account?.type
      if (accountType !== "chatgpt" && accountType !== "apiKey") {
        const failure = new ProviderRuntimeFailure(
          "codex_auth_required",
          "Codex CLI is not authenticated. Start the login flow and retry.",
          false,
        )
        await updateFailureState(failure)
        throw failure
      }

      await runtimeStore.updateState({
        adapter: "codex",
        status: "idle",
        authState: "authenticated",
        lastError: null,
        runtimePayload: account,
      })
      initialized = true
    })().catch(async (error) => {
      const failure =
        error instanceof ProviderRuntimeFailure
          ? error
          : new ProviderRuntimeFailure(
              "codex_initialize_failed",
              error instanceof Error ? error.message : "Failed to initialize Codex CLI.",
              true,
            )
      await updateFailureState(failure)
      await cleanupProcess(failure)
      throw failure
    })

    return initPromise
  }

  const ensureProviderThread = async (
    localThreadId: string,
    requestedCwd?: string | null,
    accessMode: ThreadAccessMode = "default",
  ): Promise<string> => {
    const normalizedRequestedCwd = normalizeSessionCwd(requestedCwd)
    const persistedSession = await runtimeStore.getThreadSession(localThreadId)
    const persistedProviderThreadId = persistedSession?.providerThreadId ?? null
    const persistedCwd = normalizeSessionCwd(persistedSession?.cwd)
    const cachedProviderThreadId = providerThreadIds.get(localThreadId) ?? null
    const existing =
      cachedProviderThreadId !== null && cachedProviderThreadId === persistedProviderThreadId
        ? cachedProviderThreadId
        : persistedProviderThreadId

    if (existing && persistedCwd === normalizedRequestedCwd) {
      providerThreadIds.set(localThreadId, existing)
      return existing
    }

    providerThreadIds.delete(localThreadId)
    if (existing || persistedCwd !== normalizedRequestedCwd) {
      await runtimeStore.upsertThreadSession(localThreadId, {
        providerThreadId: null,
        cwd: normalizedRequestedCwd,
        status: "idle",
        lastError: null,
      })
    }

    const threadStartPolicy = getThreadStartPolicy(accessMode)
    const response = await sendRequest<ThreadStartResponse>("thread/start", {
      cwd: normalizedRequestedCwd ?? process.cwd(),
      model: config.codexModel,
      approvalPolicy: threadStartPolicy.approvalPolicy,
      sandbox: threadStartPolicy.sandbox,
    })
    const providerThreadId = response.thread?.id
    if (!providerThreadId) {
      throw new ProviderRuntimeFailure(
        "codex_thread_start_failed",
        "Codex did not return a provider thread id.",
        true,
      )
    }

    providerThreadIds.set(localThreadId, providerThreadId)
    await runtimeStore.upsertThreadSession(localThreadId, {
      providerThreadId,
      status: "idle",
      authState: "authenticated",
      cwd: normalizedRequestedCwd,
    })
    return providerThreadId
  }

  const unsubscribeToolsChanged = pluginGateway.subscribeToolsChanged(() => {
    void pluginGateway.getInventory().catch(() => undefined)
    void reloadGatewayTools().catch(() => undefined)
  })

  return {
    initialize,
    retryInitialize: async () => {
      await cleanupProcess()
      await initialize()
      return true
    },
    reloadGatewayTools,
    startAuth: async () => {
      try {
        if (!child) {
          await initialize()
        }
        await sendRequest("account/login/start", { type: "chatgpt" })
        await runtimeStore.updateState({
          status: "auth_required",
          authState: "auth_required",
          lastError: {
            code: "codex_auth_required",
            message: "Finish the Codex ChatGPT login flow, then retry initialization.",
          },
        })
        return true
      } catch {
        return false
      }
    },
    streamTurn: async (input) => {
      await initialize()

      const providerThreadId = await ensureProviderThread(
        input.localThreadId,
        input.cwd,
        input.accessMode ?? "default",
      )
      await runtimeStore.updateState({
        status: "streaming",
        authState: "authenticated",
        lastError: null,
      })
      await runtimeStore.upsertThreadSession(input.localThreadId, {
        providerThreadId,
        status: "streaming",
        authState: "authenticated",
        cwd: normalizeSessionCwd(input.cwd),
      })

      const response = await sendRequest<TurnStartResponse>("turn/start", {
        threadId: providerThreadId,
        input: [
          {
            type: "text",
            text: input.content,
            text_elements: [],
          },
        ],
        model: input.model ?? config.codexModel,
      })

      const providerTurnId = response.turn?.id
      const activeTurn: ActiveTurn = {
        localThreadId: input.localThreadId,
        localTurnId: input.localTurnId,
        providerThreadId,
        providerTurnId: providerTurnId ?? null,
        onToken: input.onToken,
        onReasoning: input.onReasoning,
        onCompleted: input.onCompleted,
        onInterrupted: input.onInterrupted,
        onError: input.onError,
        onMcpToolCall: input.onMcpToolCall,
        onApprovalRequest: input.onApprovalRequest,
        agentMessagePhases: new Map(),
        emittedTextLengths: new Map(),
        mcpToolCalls: new Map(),
        tokenIndex: 0,
        reasoningIndex: 0,
      }

      if (!providerTurnId) {
        throw new ProviderRuntimeFailure(
          "codex_turn_start_failed",
          "Codex did not return a provider turn id.",
          true,
        )
      }

      activeProviderTurns.set(providerTurnId, activeTurn)
    },
    listPendingApprovals: () => {
      return Array.from(pendingApprovalRequests.values()).map((entry) => entry.approval)
    },
    respondToApproval: async (approvalRequestId, decision) => {
      const entry = pendingApprovalRequests.get(approvalRequestId)
      if (!entry) {
        return {
          approvalRequestId,
          threadId: "",
          turnId: "",
          decision,
          resolved: false,
        }
      }

      const result =
        entry.method === "item/commandExecution/requestApproval"
          ? { decision: decision === "approve" ? "accept" : "decline" }
          : entry.method === "item/fileChange/requestApproval"
            ? { decision: decision === "approve" ? "accept" : "decline" }
            : {
                permissions:
                  decision === "approve"
                  && isRecord(entry.rawParams)
                  && isRecord(entry.rawParams.permissions)
                    ? entry.rawParams.permissions
                    : {},
                scope: "turn",
              }

      writeMessage({
        id: entry.requestId,
        result,
      })
      pendingApprovalRequests.delete(approvalRequestId)

      return {
        approvalRequestId,
        threadId: String(entry.approval.threadId),
        turnId: String(entry.approval.turnId),
        decision,
        resolved: true,
      }
    },
    interruptTurn: async (localThreadId, localTurnId) => {
      const activeTurn = Array.from(activeProviderTurns.values()).find(
        (entry) =>
          entry.localThreadId === localThreadId && entry.localTurnId === localTurnId,
      )
      if (!activeTurn?.providerTurnId) {
        return false
      }

      await sendRequest("turn/interrupt", {
        threadId: activeTurn.providerThreadId,
        turnId: activeTurn.providerTurnId,
      })
      return true
    },
    shutdown: async () => {
      shuttingDown = true
      unsubscribeToolsChanged()
      await cleanupProcess()
      await runtimeStore.drain()
    },
  }
}

export const CodexCliLive = Layer.effect(
  CodexCli,
  Effect.gen(function* () {
    const config = yield* ConfigService
    const pluginGateway = yield* PluginGateway
    const runtimeStore = yield* ProviderRuntimeStore

    return createCodexRuntimeInstance({
      config,
      pluginGateway,
      runtimeStore,
    })
  }),
)

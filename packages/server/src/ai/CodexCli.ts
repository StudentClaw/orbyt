import { Context, Effect, Layer } from "effect"
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process"
import readline from "node:readline"
import type { ProviderRuntimeEvent } from "@student-claw/contracts"
import { ConfigService } from "../config/ConfigService.js"
import { PluginGateway } from "../mcp/PluginGateway.js"
import { ProviderRuntimeStore } from "./ProviderRuntimeStore.js"

type PendingRequest = {
  readonly timeout: ReturnType<typeof setTimeout>
  readonly resolve: (value: unknown) => void
  readonly reject: (error: Error) => void
}

type ActiveTurn = {
  readonly localThreadId: string
  readonly localTurnId: string
  readonly providerThreadId: string
  providerTurnId: string | null
  readonly onToken: (token: string, index: number) => Promise<void>
  readonly onCompleted: () => Promise<void>
  readonly onInterrupted: () => Promise<void>
  readonly onError: (error: ProviderRuntimeFailure) => Promise<void>
  readonly onMcpToolCall: (event: ProviderMcpToolCallEvent) => Promise<void>
  readonly mcpToolCalls: Map<string, Omit<CodexMcpToolCallSnapshot, "status" | "error">>
  tokenIndex: number
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
  | { method?: string; params?: unknown }

export class ProviderRuntimeFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = "ProviderRuntimeFailure"
  }
}

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
    onToken: (token: string, index: number) => Promise<void>
    onCompleted: () => Promise<void>
    onInterrupted: () => Promise<void>
    onError: (error: ProviderRuntimeFailure) => Promise<void>
    onMcpToolCall: (event: ProviderMcpToolCallEvent) => Promise<void>
  }) => Promise<void>
  readonly interruptTurn: (localThreadId: string, localTurnId: string) => Promise<boolean>
  readonly shutdown: () => Promise<void>
}

export class CodexCli extends Context.Tag("CodexCli")<
  CodexCli,
  CodexCliService
>() {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function readErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined
  const error = value.error
  if (!isRecord(error) || typeof error.message !== "string") return undefined
  return error.message
}

function readString(target: unknown, key: string): string | undefined {
  if (!isRecord(target)) return undefined
  const value = target[key]
  return typeof value === "string" ? value : undefined
}

const STUDENT_CLAW_GATEWAY_TOKEN_ENV = "STUDENT_CLAW_GATEWAY_BEARER_TOKEN"

type ActiveTurnLocator = Pick<ActiveTurn, "localThreadId" | "localTurnId">
type ProviderMcpToolCallEvent = Extract<ProviderRuntimeEvent, { readonly type: "provider.mcpToolCall" }>

type CodexMcpToolCallSnapshot = {
  readonly itemId: string
  readonly serverName: string
  readonly toolName: string
  readonly args: unknown
  readonly status: "inProgress" | "completed" | "failed"
  readonly error?: string
}

export function buildCodexAppServerArgs(config: {
  readonly pluginGatewayMcpServerName: string
  readonly pluginGatewayMcpUrl?: string
}): string[] {
  const args = ["app-server"]

  if (!config.pluginGatewayMcpUrl) {
    return args
  }

  const quotedServerName = JSON.stringify(config.pluginGatewayMcpServerName)

  args.push(
    "-c",
    `mcp_servers.${quotedServerName}.url="${config.pluginGatewayMcpUrl}"`,
    "-c",
    `mcp_servers.${quotedServerName}.bearer_token_env_var="${STUDENT_CLAW_GATEWAY_TOKEN_ENV}"`,
  )

  return args
}

function readMcpToolCallItem(item: unknown): CodexMcpToolCallSnapshot | null {
  if (!isRecord(item) || item.type !== "mcpToolCall") {
    return null
  }

  const itemId = readString(item, "id")
  const serverName = readString(item, "server")
  const toolName = readString(item, "tool")
  const status = readString(item, "status")
  if (
    !itemId
    || !serverName
    || !toolName
    || (status !== "inProgress" && status !== "completed" && status !== "failed")
  ) {
    return null
  }

  const error = isRecord(item.error) && typeof item.error.message === "string"
    ? item.error.message
    : undefined

  return {
    itemId,
    serverName,
    toolName,
    args: "arguments" in item ? item.arguments : {},
    status,
    error,
  }
}

export function mapCodexMcpToolCallStartedEvent(
  params: unknown,
  activeTurn: ActiveTurnLocator,
): ProviderMcpToolCallEvent | null {
  const item = isRecord(params) ? params.item : null
  const mcpToolCall = readMcpToolCallItem(item)
  if (!mcpToolCall) {
    return null
  }

  const event: ProviderMcpToolCallEvent = {
    type: "provider.mcpToolCall",
    threadId: activeTurn.localThreadId as never,
    turnId: activeTurn.localTurnId as never,
    itemId: mcpToolCall.itemId,
    serverName: mcpToolCall.serverName,
    toolName: mcpToolCall.toolName,
    args: mcpToolCall.args,
    status: "pending",
  }

  return event
}

export function mapCodexMcpToolCallProgressEvent(
  params: unknown,
  activeTurn: ActiveTurnLocator,
  snapshot?: Omit<CodexMcpToolCallSnapshot, "status" | "error">,
): ProviderMcpToolCallEvent | null {
  const itemId = readString(params, "itemId")
  const message = readString(params, "message")
  if (!itemId || !message) {
    return null
  }

  const serverName = snapshot?.serverName ?? readString(params, "serverName") ?? "student-claw"
  const toolName = snapshot?.toolName ?? readString(params, "toolName") ?? "unknown"
  const args = snapshot?.args ?? (isRecord(params) && "arguments" in params ? params.arguments : {})

  const event: ProviderMcpToolCallEvent = {
    type: "provider.mcpToolCall",
    threadId: activeTurn.localThreadId as never,
    turnId: activeTurn.localTurnId as never,
    itemId,
    serverName,
    toolName,
    args,
    status: "pending",
    message,
  }

  return event
}

export function mapCodexMcpToolCallCompletedEvent(
  params: unknown,
  activeTurn: ActiveTurnLocator,
  snapshot?: Omit<CodexMcpToolCallSnapshot, "status" | "error">,
): ProviderMcpToolCallEvent | null {
  const item = isRecord(params) ? params.item : null
  const mcpToolCall = readMcpToolCallItem(item)
  if (!mcpToolCall) {
    return null
  }

  const event: ProviderMcpToolCallEvent = {
    type: "provider.mcpToolCall",
    threadId: activeTurn.localThreadId as never,
    turnId: activeTurn.localTurnId as never,
    itemId: mcpToolCall.itemId,
    serverName: snapshot?.serverName ?? mcpToolCall.serverName,
    toolName: snapshot?.toolName ?? mcpToolCall.toolName,
    args: snapshot?.args ?? mcpToolCall.args,
    status: mcpToolCall.status === "failed" ? "error" : "complete",
    error: mcpToolCall.error,
  }

  return event
}

function readAuthFailure(stdout: string, stderr: string): ProviderRuntimeFailure | null {
  const output = `${stdout}\n${stderr}`.toLowerCase()
  if (output.includes("logged in")) {
    return null
  }

  if (
    output.includes("not logged in") ||
    output.includes("authentication required") ||
    output.includes("login required")
  ) {
    return new ProviderRuntimeFailure(
      "codex_auth_required",
      "Codex CLI is not authenticated. Start the login flow and retry.",
      false,
    )
  }

  return null
}

function normalizeSessionCwd(cwd: string | null | undefined): string | null {
  if (typeof cwd !== "string") {
    return null
  }

  const normalized = cwd.trim()
  return normalized.length > 0 ? normalized : null
}

function buildInitializeParams() {
  return {
    clientInfo: {
      name: "student-claw",
      title: "Student Claw",
      version: "0.1.0",
    },
    capabilities: {
      experimentalApi: true,
    },
  } as const
}

export const CodexCliLive = Layer.effect(
  CodexCli,
  Effect.gen(function* () {
    const config = yield* ConfigService
    const pluginGateway = yield* PluginGateway
    const runtimeStore = yield* ProviderRuntimeStore

    const binaryPath = config.codexBinaryPath
    const homePath = config.codexHomePath
    const processHomePath = config.codexProcessHomePath
    const providerThreadIds = new Map<string, string>()
    const activeProviderTurns = new Map<string, ActiveTurn>()
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
        entry.reject(failure ?? new ProviderRuntimeFailure(
          "codex_process_closed",
          "Codex app-server stopped unexpectedly.",
          true,
        ))
      }
      pending = new Map()

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
          reject(new ProviderRuntimeFailure(
            "codex_request_timeout",
            `Timed out waiting for Codex response to ${method}.`,
            true,
          ))
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

    const handleNotification = async (message: JsonRpcMessage) => {
      const method = "method" in message && typeof message.method === "string" ? message.method : null
      if (!method) return

      if (method === "account/rateLimits/updated") {
        const params = "params" in message && isRecord(message.params) ? message.params : null
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
            entry.providerThreadId === providerThreadId &&
            entry.providerTurnId === null,
        )
        if (activeTurn) {
          activeTurn.providerTurnId = providerTurnId
        }
        return
      }

      const activeTurn = providerTurnId ? activeProviderTurns.get(providerTurnId) : null
      if (!activeTurn) return

      if (method === "item/started") {
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
        if (!delta) return
        const nextIndex = activeTurn.tokenIndex
        activeTurn.tokenIndex += 1
        await activeTurn.onToken(delta, nextIndex)
        return
      }

      if (method === "item/completed") {
        const item = isRecord(params) ? params.item : null
        const itemId = isRecord(item) ? readString(item, "id") : undefined
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

        if ("id" in parsed && parsed.id != null) {
          const entry = pending.get(String(parsed.id))
          if (!entry) return
          clearTimeout(entry.timeout)
          pending.delete(String(parsed.id))
          const errorMessage = readErrorMessage(parsed)
          if (errorMessage) {
            entry.reject(new ProviderRuntimeFailure(
              "codex_request_failed",
              errorMessage,
              !errorMessage.toLowerCase().includes("auth"),
            ))
            return
          }
          entry.resolve(parsed.result)
          return
        }

        void handleNotification(parsed)
      })

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString()
        if (text.toLowerCase().includes("rate limit")) {
          void updateFailureState(new ProviderRuntimeFailure(
            "codex_rate_limited",
            "Codex rate limit reached. Retry later.",
            true,
          ))
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

      const response = await sendRequest<ThreadStartResponse>("thread/start", {
        cwd: normalizedRequestedCwd ?? process.cwd(),
        model: config.codexModel,
        approvalPolicy: "never",
        sandbox: "danger-full-access",
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

        const providerThreadId = await ensureProviderThread(input.localThreadId, input.cwd)
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
          model: config.codexModel,
        })

        const providerTurnId = response.turn?.id
        const activeTurn: ActiveTurn = {
          localThreadId: input.localThreadId,
          localTurnId: input.localTurnId,
          providerThreadId,
          providerTurnId: providerTurnId ?? null,
          onToken: input.onToken,
          onCompleted: input.onCompleted,
          onInterrupted: input.onInterrupted,
          onError: input.onError,
          onMcpToolCall: input.onMcpToolCall,
          mcpToolCalls: new Map(),
          tokenIndex: 0,
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
      interruptTurn: async (localThreadId, localTurnId) => {
        const activeTurn = Array.from(activeProviderTurns.values()).find(
          (entry) => entry.localThreadId === localThreadId && entry.localTurnId === localTurnId,
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
      },
    }
  }),
)

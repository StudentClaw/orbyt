import { randomBytes } from "node:crypto"
import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from "node:http"
import { once } from "node:events"
import type {
  ExtensionRegistryEntry,
  GatewayToolCallFailure,
  GatewayToolCallParams,
  GatewayToolCallResult,
  GatewayToolInventoryEntry,
  GatewayToolInventoryReadResult,
  GatewayToolInventorySnapshot,
  GatewayToolsChangedEvent,
} from "@orbyt/contracts"
import { createGatewayInventorySnapshot, formatGatewayToolName } from "./plugin-gateway-inventory.js"

type PluginGatewayRuntime = {
  readonly list: () => ExtensionRegistryEntry[]
  readonly callTool: (pluginId: string, toolName: string, args?: Record<string, unknown>) => Promise<unknown>
}

type SseClient = {
  readonly response: ServerResponse
}

export type PluginGatewayServiceConfig = {
  readonly baseUrl: string
  readonly bridgeUrl: string
  readonly bridgeEventsUrl: string
  readonly bridgeToken: string
  readonly mcpUrl: string
  readonly mcpBearerToken: string
  readonly mcpServerName: string
}

export type PluginGatewayService = {
  readonly config: PluginGatewayServiceConfig
  readonly notifyToolInventoryChanged: () => Promise<void>
  readonly close: () => Promise<void>
}

export type PluginGatewayController = {
  readonly getSnapshot: () => GatewayToolInventorySnapshot
  readonly routeToolCall: (params: GatewayToolCallParams) => Promise<GatewayToolCallResult>
  readonly notifyToolInventoryChanged: () => Promise<void>
  readonly subscribeToolsChanged: (listener: (event: GatewayToolsChangedEvent) => void | Promise<void>) => () => void
}

type ResolvedToolTarget =
  | ({ readonly state: "running" } & GatewayToolInventoryEntry)
  | ({ readonly state: "stopped" } & GatewayToolInventoryEntry)
  | {
    readonly state: "missing"
    readonly exposedToolName: string
  }

function createAuthToken(): string {
  return randomBytes(32).toString("hex")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

function asToolArgs(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

function readGatewayToolCallParams(value: unknown): GatewayToolCallParams | null {
  if (!isRecord(value) || typeof value.exposedToolName !== "string") {
    return null
  }

  return {
    exposedToolName: value.exposedToolName,
    args: "args" in value ? value.args : {},
  }
}

function readRpcMethod(value: unknown): string | null {
  return isRecord(value) && typeof value.method === "string" ? value.method : null
}

function readRpcId(value: unknown): string | number | null {
  if (!isRecord(value)) return null
  const id = value.id
  return typeof id === "string" || typeof id === "number" ? id : null
}

function readAuthorizationToken(request: IncomingMessage): string | null {
  const header = request.headers.authorization
  if (!header || !header.startsWith("Bearer ")) {
    return null
  }

  const token = header.slice("Bearer ".length).trim()
  return token.length > 0 ? token : null
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.statusCode = statusCode
  response.setHeader("content-type", "application/json")
  response.end(JSON.stringify(payload))
}

function writeUnauthorized(response: ServerResponse): void {
  response.statusCode = 401
  response.setHeader("www-authenticate", "Bearer")
  response.end("Unauthorized")
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return {}
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

function createFailure(
  failure: GatewayToolCallFailure,
): GatewayToolCallFailure {
  return failure
}

// ── MCP JSON-RPC helpers (no SDK transport needed) ──────────────────────

const MCP_PROTOCOL_VERSION = "2025-03-26"

type McpSseClient = { readonly response: ServerResponse }

function jsonRpcResult(id: string | number | null, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result }
}

function jsonRpcError(id: string | number | null, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } }
}

// ── Gateway controller (unchanged) ──────────────────────────────────────

export function createPluginGatewayController(options: {
  readonly runtime: PluginGatewayRuntime
}): PluginGatewayController {
  let revision = 0
  let currentSnapshot = createGatewayInventorySnapshot(options.runtime.list(), revision, new Date().toISOString())
  let currentFingerprint = fingerprintSnapshot(currentSnapshot)
  const listeners = new Set<(event: GatewayToolsChangedEvent) => void | Promise<void>>()

  function getSnapshot(): GatewayToolInventorySnapshot {
    return currentSnapshot
  }

  function resolveToolTarget(exposedToolName: string): ResolvedToolTarget {
    const running = currentSnapshot.tools.find((entry) => entry.exposedToolName === exposedToolName)
    if (running) {
      return {
        state: "running",
        ...running,
      }
    }

    const knownEntry = options.runtime.list().find((entry: ExtensionRegistryEntry) => {
      if (entry.kind !== "available" || !entry.enabled) {
        return false
      }

      return entry.manifest.tools.some((tool) => {
        return formatGatewayToolName(entry.manifest.id, tool.name) === exposedToolName
      })
    })

    if (!knownEntry || knownEntry.kind !== "available") {
      return {
        state: "missing",
        exposedToolName,
      }
    }

    const tool = knownEntry.manifest.tools.find((candidate) => {
      return formatGatewayToolName(knownEntry.manifest.id, candidate.name) === exposedToolName
    })

    if (!tool) {
      return {
        state: "missing",
        exposedToolName,
      }
    }

    return {
      state: "stopped",
      exposedToolName,
      description: tool.description,
      pluginId: knownEntry.manifest.id,
      rawToolName: tool.name,
    }
  }

  async function routeToolCall(params: GatewayToolCallParams): Promise<GatewayToolCallResult> {
    const target = resolveToolTarget(params.exposedToolName)
    if (target.state === "missing") {
      return createFailure({
        ok: false,
        exposedToolName: params.exposedToolName,
        reason: "tool_not_available",
        message: `Tool ${params.exposedToolName} is not available.`,
      })
    }

    if (target.state === "stopped") {
      return createFailure({
        ok: false,
        exposedToolName: params.exposedToolName,
        reason: "plugin_not_running",
        message: `Plugin ${target.pluginId} is not running.`,
        pluginId: target.pluginId,
        rawToolName: target.rawToolName,
      })
    }

    try {
      const result = await options.runtime.callTool(
        target.pluginId,
        target.rawToolName,
        asToolArgs(params.args),
      )

      return {
        ok: true,
        exposedToolName: target.exposedToolName,
        pluginId: target.pluginId,
        rawToolName: target.rawToolName,
        result,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const reason = message.toLowerCase().includes("not running")
        ? "plugin_not_running"
        : "call_failed"

      return createFailure({
        ok: false,
        exposedToolName: target.exposedToolName,
        reason,
        message,
        pluginId: target.pluginId,
        rawToolName: target.rawToolName,
      })
    }
  }

  async function publishToolsChanged(): Promise<void> {
    const event: GatewayToolsChangedEvent = {
      type: "toolsChanged",
      snapshot: currentSnapshot,
    }

    for (const listener of listeners) {
      await listener(event)
    }
  }

  async function notifyToolInventoryChanged(): Promise<void> {
    const nextSnapshot = createGatewayInventorySnapshot(
      options.runtime.list(),
      revision + 1,
      new Date().toISOString(),
    )
    const nextFingerprint = fingerprintSnapshot(nextSnapshot)
    if (nextFingerprint === currentFingerprint) {
      return
    }

    revision += 1
    currentSnapshot = {
      ...nextSnapshot,
      revision,
    }
    currentFingerprint = nextFingerprint
    await publishToolsChanged()
  }

  return {
    getSnapshot,
    routeToolCall,
    notifyToolInventoryChanged,
    subscribeToolsChanged: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

// ── Gateway HTTP service ────────────────────────────────────────────────

export function createPluginGatewayService(options: {
  readonly runtime: PluginGatewayRuntime
  readonly serverName?: string
  readonly host?: string
}): Promise<PluginGatewayService> {
  const host = options.host ?? "127.0.0.1"
  const serverName = options.serverName ?? "orbyt"
  const bridgeToken = createAuthToken()
  const mcpBearerToken = createAuthToken()
  const sseClients = new Set<SseClient>()
  const mcpSseClients = new Set<McpSseClient>()
  const controller = createPluginGatewayController({
    runtime: options.runtime,
  })

  let httpServer: HttpServer | null = null
  let closed = false
  const unsubscribeToolsChanged = controller.subscribeToolsChanged(async (event) => {
    for (const client of sseClients) {
      try {
        client.response.write(`event: toolsChanged\n`)
        client.response.write(`data: ${JSON.stringify(event)}\n\n`)
      } catch {
        sseClients.delete(client)
      }
    }

    sendMcpToolsListChanged()
  })

  function sendMcpToolsListChanged(): void {
    const notification = JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/tools/list_changed",
    })
    for (const client of mcpSseClients) {
      try {
        client.response.write(`event: message\ndata: ${notification}\n\n`)
      } catch {
        mcpSseClients.delete(client)
      }
    }
  }

  // ── MCP /mcp endpoint handlers ──────────────────────────────────────

  function handleMcpInitialize(id: string | number | null) {
    return jsonRpcResult(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverInfo: { name: serverName, version: "0.1.0" },
      capabilities: { tools: { listChanged: true } },
    })
  }

  function handleMcpToolsList(id: string | number | null) {
    return jsonRpcResult(id, {
      tools: controller.getSnapshot().tools.map((tool: GatewayToolInventoryEntry) => ({
        name: tool.exposedToolName,
        description: tool.description,
        inputSchema: {
          type: "object",
          additionalProperties: true,
        },
      })),
    })
  }

  async function handleMcpToolsCall(id: string | number | null, params: unknown) {
    const p = isRecord(params) ? params : {}
    const name = typeof p.name === "string" ? p.name : undefined
    if (!name) {
      return jsonRpcError(id, -32602, "Missing tool name")
    }

    const result = await controller.routeToolCall({
      exposedToolName: name,
      args: asToolArgs(p.arguments),
    })

    if (!result.ok) {
      return jsonRpcError(
        id,
        result.reason === "tool_not_available" ? -32601 : -32603,
        `${result.reason}: ${result.message}`,
      )
    }

    return jsonRpcResult(id, result.result)
  }

  function handleMcpGetSse(response: ServerResponse): void {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    })

    const client: McpSseClient = { response }
    mcpSseClients.add(client)
    response.on("close", () => {
      mcpSseClients.delete(client)
    })
    response.on("error", () => {
      mcpSseClients.delete(client)
    })
  }

  async function handleMcpPost(parsedBody: unknown, response: ServerResponse): Promise<void> {
    const method = readRpcMethod(parsedBody)
    const id = readRpcId(parsedBody)

    if (method === "initialize") {
      writeJson(response, 200, handleMcpInitialize(id))
      return
    }

    if (method === "notifications/initialized") {
      response.statusCode = 202
      response.end()
      return
    }

    if (method === "tools/list") {
      writeJson(response, 200, handleMcpToolsList(id))
      return
    }

    if (method === "tools/call") {
      const params = isRecord(parsedBody) ? parsedBody.params : undefined
      writeJson(response, 200, await handleMcpToolsCall(id, params))
      return
    }

    if (method === "ping") {
      writeJson(response, 200, jsonRpcResult(id, {}))
      return
    }

    if (method?.startsWith("notifications/")) {
      response.statusCode = 202
      response.end()
      return
    }

    writeJson(response, 200, jsonRpcError(id, -32601, `Method not found: ${method}`))
  }

  // ── Bridge endpoint handlers ────────────────────────────────────────

  async function handleBridgeInventory(response: ServerResponse): Promise<void> {
    const payload: GatewayToolInventoryReadResult = {
      snapshot: controller.getSnapshot(),
    }
    writeJson(response, 200, payload)
  }

  async function handleBridgeCallTool(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const params = readGatewayToolCallParams(await readJsonBody(request))
    if (!params) {
      writeJson(response, 400, {
        error: "invalid_params",
      })
      return
    }

    writeJson(response, 200, await controller.routeToolCall(params))
  }

  async function handleBridgeEvents(response: ServerResponse): Promise<void> {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    })
    response.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`)

    const client: SseClient = { response }
    sseClients.add(client)
    response.on("close", () => {
      sseClients.delete(client)
    })
    response.on("error", () => {
      sseClients.delete(client)
    })
  }

  // ── Top-level request router ────────────────────────────────────────

  async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = request.url ? new URL(request.url, `http://${host}`).pathname : "/"

    if (path === "/mcp") {
      if (readAuthorizationToken(request) !== mcpBearerToken) {
        writeUnauthorized(response)
        return
      }

      if (request.method === "GET") {
        handleMcpGetSse(response)
        return
      }

      if (request.method === "DELETE") {
        response.statusCode = 200
        response.end()
        return
      }

      const parsedBody = await readJsonBody(request)
      await handleMcpPost(parsedBody, response)
      return
    }

    if (path === "/bridge/tool-inventory") {
      if (readAuthorizationToken(request) !== bridgeToken) {
        writeUnauthorized(response)
        return
      }

      await handleBridgeInventory(response)
      return
    }

    if (path === "/bridge/call-tool" && request.method === "POST") {
      if (readAuthorizationToken(request) !== bridgeToken) {
        writeUnauthorized(response)
        return
      }

      await handleBridgeCallTool(request, response)
      return
    }

    if (path === "/bridge/events") {
      if (readAuthorizationToken(request) !== bridgeToken) {
        writeUnauthorized(response)
        return
      }

      await handleBridgeEvents(response)
      return
    }

    response.statusCode = 404
    response.end("Not found")
  }

  return (async () => {
    httpServer = createServer((request, response) => {
      void handleRequest(request, response).catch((error) => {
        if (!response.headersSent) {
          writeJson(response, 500, {
            error: error instanceof Error ? error.message : String(error),
          })
          return
        }

        response.end()
      })
    })

    httpServer.listen()
    await once(httpServer, "listening")

    const address = httpServer.address()
    if (!address || typeof address === "string") {
      throw new Error("Plugin gateway failed to bind a loopback port.")
    }

    const baseUrl = `http://${host}:${address.port}`

    return {
      config: {
        baseUrl,
        bridgeUrl: `${baseUrl}/bridge`,
        bridgeEventsUrl: `${baseUrl}/bridge/events`,
        bridgeToken,
        mcpUrl: `${baseUrl}/mcp`,
        mcpBearerToken,
        mcpServerName: serverName,
      },
      notifyToolInventoryChanged: async () => {
        await controller.notifyToolInventoryChanged()
      },
      close: async () => {
        if (closed) {
          return
        }

        closed = true
        unsubscribeToolsChanged()
        for (const client of sseClients) {
          client.response.end()
        }
        sseClients.clear()
        for (const client of mcpSseClients) {
          client.response.end()
        }
        mcpSseClients.clear()
        if (httpServer) {
          await new Promise<void>((resolve) => {
            httpServer?.close(() => resolve())
          })
          httpServer = null
        }
      },
    } satisfies PluginGatewayService
  })()
}

function fingerprintSnapshot(snapshot: GatewayToolInventorySnapshot): string {
  return JSON.stringify(snapshot.tools.map((tool: GatewayToolInventoryEntry) => [
    tool.exposedToolName,
    tool.description,
    tool.pluginId,
    tool.rawToolName,
  ]))
}

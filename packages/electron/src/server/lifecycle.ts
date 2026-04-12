import { randomBytes } from "node:crypto"
import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { WebSocket } from "ws"
import { RPC_METHODS, WS_PROTOCOL, type DesktopBootstrap } from "@student-claw/contracts"

/**
 * Running server process metadata returned to Electron startup.
 */
export interface ServerProcess {
  readonly port: number
  readonly bootstrap: DesktopBootstrap
  readonly process: ChildProcess | null
  readonly owned: boolean
  readonly kill: () => void
}

export type PluginGatewayLaunchConfig = {
  readonly bridgeUrl: string
  readonly bridgeEventsUrl: string
  readonly bridgeToken: string
  readonly mcpUrl: string
  readonly mcpBearerToken: string
  readonly mcpServerName: string
}

export type CodexIsolationConfig = {
  readonly userDataPath: string
}

const HEALTH_CHECK_REQUEST_ID = "health-check"
const AUTH_PROTOCOL_PREFIX = "auth."

type WsHandshakeAuth = {
  readonly authToken: string
}

type WebSocketFactory = (url: string, protocols: string[]) => WebSocket

function createHandshakeAuth(): WsHandshakeAuth {
  return { authToken: randomBytes(32).toString("hex") }
}

function buildProtocols(auth: WsHandshakeAuth): string[] {
  return [WS_PROTOCOL, `${AUTH_PROTOCOL_PREFIX}${auth.authToken}`]
}

function createHealthCheckSocket(
  port: number,
  auth: WsHandshakeAuth,
  createWebSocket: WebSocketFactory,
): WebSocket {
  return createWebSocket(`ws://127.0.0.1:${port}`, buildProtocols(auth))
}

function sendBootstrapRequest(ws: WebSocket): void {
  ws.send(JSON.stringify({
    kind: "request",
    method: RPC_METHODS.SERVER_GET_BOOTSTRAP,
    id: HEALTH_CHECK_REQUEST_ID,
    params: {},
  }))
}

function isBootstrapResponse(
  message: unknown,
): message is {
  readonly kind: "response"
  readonly id: typeof HEALTH_CHECK_REQUEST_ID
  readonly ok: true
  readonly result: DesktopBootstrap
} {
  if (typeof message !== "object" || message === null) {
    return false
  }

  const candidate = message as Record<string, unknown>
  return (
    candidate.kind === "response"
    && candidate.id === HEALTH_CHECK_REQUEST_ID
    && candidate.ok === true
    && typeof candidate.result === "object"
    && candidate.result !== null
  )
}

function isFailedBootstrapResponse(
  message: unknown,
): message is {
  readonly kind: "response"
  readonly id: typeof HEALTH_CHECK_REQUEST_ID
  readonly ok: false
} {
  if (typeof message !== "object" || message === null) {
    return false
  }

  const candidate = message as Record<string, unknown>
  return (
    candidate.kind === "response"
    && candidate.id === HEALTH_CHECK_REQUEST_ID
    && candidate.ok === false
  )
}

/**
 * Probes the local runtime port and returns bootstrap data only when the auth token matches.
 */
export function healthCheck(
  port: number,
  auth: WsHandshakeAuth,
  createWebSocket: WebSocketFactory = (url, protocols) => new WebSocket(url, protocols),
): Promise<DesktopBootstrap | null> {
  return new Promise((resolve) => {
    const ws = createHealthCheckSocket(port, auth, createWebSocket)
    let settled = false

    const finish = (result: DesktopBootstrap | null) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)
      ws.close()
      resolve(result)
    }

    const timeout = setTimeout(() => {
      finish(null)
    }, 2000)

    ws.on("open", () => {
      sendBootstrapRequest(ws)
    })

    ws.on("message", (data) => {
      handleHealthCheckMessage(data.toString(), auth, finish)
    })

    ws.on("error", () => {
      finish(null)
    })

    ws.on("close", () => {
      finish(null)
    })
  })
}

/**
 * Reuses an authenticated local runtime when possible, otherwise spawns and verifies a new one.
 */
export async function spawnServer(
  gateway?: PluginGatewayLaunchConfig,
  codexIsolation?: CodexIsolationConfig,
): Promise<ServerProcess> {
  const port = Number(process.env.SERVER_PORT ?? 8787)
  const dbPath = process.env.DB_PATH ?? `${process.env.HOME}/.student-claw/data.db`
  const auth = createHandshakeAuth()

  const existingBootstrap = await healthCheck(port, auth)
  if (existingBootstrap) {
    return {
      port,
      bootstrap: existingBootstrap,
      process: null,
      owned: false,
      kill: () => undefined,
    }
  }

  const serverPath = new URL("../../../server/src/index.ts", import.meta.url).pathname

  const child = spawnServerChild(serverPath, port, dbPath, auth, gateway, codexIsolation)
  pipeChildOutput(child)

  // Health check with retry/backoff
  const maxAttempts = 10
  let delay = 500

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, delay))
    const bootstrap = await healthCheck(port, auth)
    if (bootstrap) {
      return {
        port,
        bootstrap,
        process: child,
        owned: true,
        kill: () => {
          child.kill("SIGTERM")
        },
      }
    }
    delay = Math.min(delay * 2, 5000)
  }

  child.kill("SIGTERM")
  throw new Error(`Server failed to start after ${maxAttempts} attempts`)
}

function writeIfPresent(sourcePath: string, destinationPath: string): void {
  if (!existsSync(sourcePath)) {
    return
  }

  writeFileSync(destinationPath, readFileSync(sourcePath))
}

function buildIsolatedConfigToml(gateway?: PluginGatewayLaunchConfig): string {
  if (!gateway?.mcpUrl) {
    return ""
  }

  return [
    `[mcp_servers.${JSON.stringify(gateway.mcpServerName)}]`,
    `url = ${JSON.stringify(gateway.mcpUrl)}`,
    `bearer_token_env_var = "STUDENT_CLAW_GATEWAY_BEARER_TOKEN"`,
    `enabled = true`,
    "",
  ].join("\n")
}

function prepareIsolatedCodexRuntime(
  userDataPath: string,
  gateway?: PluginGatewayLaunchConfig,
): {
  readonly codexHomePath: string
  readonly codexProcessHomePath: string
} {
  const codexHomePath = path.join(userDataPath, "codex-home")
  const codexProcessHomePath = path.join(userDataPath, "codex-user-home")

  mkdirSync(codexHomePath, { recursive: true })
  mkdirSync(codexProcessHomePath, { recursive: true })
  mkdirSync(path.join(codexProcessHomePath, ".agents", "skills"), { recursive: true })

  const globalCodexHome = path.join(process.env.HOME ?? "", ".codex")
  writeIfPresent(path.join(globalCodexHome, "auth.json"), path.join(codexHomePath, "auth.json"))
  writeIfPresent(path.join(globalCodexHome, "installation_id"), path.join(codexHomePath, "installation_id"))

  // Keep Student Claw's Codex runtime deterministic: no inherited MCP servers,
  // no inherited plugin toggles, and no global skill config -- except for the
  // gateway MCP server, which must be on disk so that `config/mcpServer/reload`
  // can re-discover it when the tool inventory changes at runtime.
  writeFileSync(path.join(codexHomePath, "config.toml"), buildIsolatedConfigToml(gateway), "utf8")

  return {
    codexHomePath,
    codexProcessHomePath,
  }
}

function handleHealthCheckMessage(
  raw: string,
  auth: WsHandshakeAuth,
  finish: (result: DesktopBootstrap | null) => void,
): void {
  try {
    const message = JSON.parse(raw)
    if (isBootstrapResponse(message)) {
      finish(message.result.wsAuthToken === auth.authToken ? message.result : null)
      return
    }

    if (isFailedBootstrapResponse(message)) {
      finish(null)
    }
  } catch {
    // Ignore unrelated or malformed frames and keep waiting for the bootstrap response.
  }
}

function spawnServerChild(
  serverPath: string,
  port: number,
  dbPath: string,
  auth: WsHandshakeAuth,
  gateway?: PluginGatewayLaunchConfig,
  codexIsolation?: CodexIsolationConfig,
): ChildProcess {
  const isolatedCodexRuntime = codexIsolation
    ? prepareIsolatedCodexRuntime(codexIsolation.userDataPath, gateway)
    : null
  const child = spawn("bun", ["run", serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      WS_AUTH_TOKEN: auth.authToken,
      ...(isolatedCodexRuntime ? {
        CODEX_HOME_PATH: isolatedCodexRuntime.codexHomePath,
        CODEX_PROCESS_HOME_PATH: isolatedCodexRuntime.codexProcessHomePath,
      } : {}),
      ...(gateway ? {
        PLUGIN_GATEWAY_BRIDGE_URL: gateway.bridgeUrl,
        PLUGIN_GATEWAY_BRIDGE_EVENTS_URL: gateway.bridgeEventsUrl,
        PLUGIN_GATEWAY_BRIDGE_TOKEN: gateway.bridgeToken,
        PLUGIN_GATEWAY_MCP_URL: gateway.mcpUrl,
        PLUGIN_GATEWAY_MCP_BEARER_TOKEN: gateway.mcpBearerToken,
        PLUGIN_GATEWAY_MCP_SERVER_NAME: gateway.mcpServerName,
      } : {}),
    },
    stdio: "pipe",
  })

  // Ensure the server child dies when the parent Electron process exits,
  // including SIGTERM from electron-vite dev restarts.
  const killChild = () => {
    if (!child.killed) {
      child.kill("SIGTERM")
    }
  }
  process.on("exit", killChild)
  process.on("SIGTERM", killChild)
  process.on("SIGINT", killChild)

  return child
}

function pipeChildOutput(child: ChildProcess): void {
  child.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(formatChildLog(data))
  })
  child.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(formatChildLog(data))
  })
}

function formatChildLog(data: Buffer): string {
  const text = data.toString().trim()
  return text ? `[server] ${text}\n` : ""
}

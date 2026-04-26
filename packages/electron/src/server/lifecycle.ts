import { randomBytes } from "node:crypto"
import { spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { WebSocket } from "ws"
import { RPC_METHODS, WS_PROTOCOL, type DesktopBootstrap } from "@orbyt/contracts"
import { buildIsolatedCodexEnv, type PluginGatewayLaunchConfig } from "../codex/runtime.js"

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

export type CodexIsolationConfig = {
  readonly userDataPath: string
}

export type ServerLaunchContext = {
  readonly isPackaged?: boolean
  readonly resourcesPath?: string
}

export type ServerLaunchSpec = {
  readonly command: string
  readonly args: string[]
  readonly serverPath: string
  readonly packaged: boolean
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
  launchContext: ServerLaunchContext = {},
): Promise<ServerProcess> {
  const port = Number(process.env.SERVER_PORT ?? 8787)
  const dbPath = process.env.DB_PATH ?? `${process.env.HOME}/.orbyt/data.db`
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

  const launchSpec = resolveServerLaunchSpec(launchContext)
  const child = spawnServerChild(launchSpec, port, dbPath, auth, gateway, codexIsolation)
  pipeChildOutput(child)
  const childError = createChildErrorTracker(child)

  // Health check with retry/backoff
  const maxAttempts = 10
  let delay = 500

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await waitForAttemptDelay(delay, childError)
      const bootstrap = await raceWithChildError(healthCheck(port, auth), childError)
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
  } catch (error) {
    child.kill("SIGTERM")
    throw normalizeServerLaunchError(error, launchSpec)
  }

  child.kill("SIGTERM")
  throw new Error(`Server failed to start after ${maxAttempts} attempts`)
}

export function resolveServerLaunchSpec(options: ServerLaunchContext = {}): ServerLaunchSpec {
  if (options.isPackaged) {
    const resourcesRoot = options.resourcesPath ?? process.resourcesPath ?? ""
    const serverPath = path.join(
      resourcesRoot,
      "app.asar",
      "node_modules",
      "@orbyt",
      "server",
      "dist",
      "index.js",
    )

    if (!existsSync(serverPath)) {
      throw new Error(`Packaged Orbyt server runtime not found at ${serverPath}`)
    }

    return {
      command: process.execPath,
      args: [serverPath],
      serverPath,
      packaged: true,
    }
  }

  const serverPath = new URL("../../../server/src/index.ts", import.meta.url).pathname
  return {
    command: "bun",
    args: ["run", serverPath],
    serverPath,
    packaged: false,
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
  launchSpec: ServerLaunchSpec,
  port: number,
  dbPath: string,
  auth: WsHandshakeAuth,
  gateway?: PluginGatewayLaunchConfig,
  codexIsolation?: CodexIsolationConfig,
): ChildProcess {
  // Capture the real `~/.orbyt` BEFORE buildIsolatedCodexEnv overrides HOME.
  // Memory paths are resolved from ORBYT_HOME (treated as the directory that
  // contains `memory/`). Without this, the server's `~/.orbyt/` would land
  // inside the Codex isolation sandbox at codex-user-home/.orbyt instead of
  // the user's real `~/.orbyt`.
  const orbytHome = process.env.ORBYT_HOME ?? path.join(homedir(), ".orbyt")

  const child = spawn(launchSpec.command, launchSpec.args, {
    env: {
      ...(codexIsolation ? buildIsolatedCodexEnv(codexIsolation.userDataPath, gateway) : process.env),
      PORT: String(port),
      DB_PATH: dbPath,
      WS_AUTH_TOKEN: auth.authToken,
      ORBYT_HOME: orbytHome,
      ...(launchSpec.packaged ? {
        ELECTRON_RUN_AS_NODE: "1",
      } : {}),
      ...(codexIsolation ? {
        CODEX_HOME_PATH: path.join(codexIsolation.userDataPath, "codex-home"),
        CODEX_PROCESS_HOME_PATH: path.join(codexIsolation.userDataPath, "codex-user-home"),
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

function createChildErrorTracker(child: ChildProcess): Promise<never> {
  return new Promise((_, reject) => {
    child.once("error", (error) => {
      reject(error)
    })
  })
}

function waitForAttemptDelay(delayMs: number, childError: Promise<never>): Promise<void> {
  return Promise.race([
    new Promise<void>((resolve) => setTimeout(resolve, delayMs)),
    childError,
  ])
}

function raceWithChildError<T>(work: Promise<T>, childError: Promise<never>): Promise<T> {
  return Promise.race([work, childError])
}

function normalizeServerLaunchError(error: unknown, launchSpec: ServerLaunchSpec): Error {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    if (launchSpec.packaged) {
      return new Error(`Packaged Orbyt server runtime could not be launched: ${launchSpec.serverPath}`)
    }

    return new Error(`Orbyt server runtime command was not found: ${launchSpec.command}`)
  }

  return error instanceof Error ? error : new Error(String(error))
}

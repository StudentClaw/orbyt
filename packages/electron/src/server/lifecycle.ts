import { randomBytes } from "node:crypto"
import { spawn, type ChildProcess } from "node:child_process"
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
export async function spawnServer(): Promise<ServerProcess> {
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

  const child = spawnServerChild(serverPath, port, dbPath, auth)
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
): ChildProcess {
  return spawn("bun", ["run", serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
      WS_AUTH_TOKEN: auth.authToken,
    },
    stdio: "pipe",
  })
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

import { spawn, type ChildProcess } from "node:child_process"
import { WebSocket } from "ws"
import { RPC_METHODS, type DesktopBootstrap } from "@student-claw/contracts"

export interface ServerProcess {
  readonly port: number
  readonly bootstrap: DesktopBootstrap
  readonly process: ChildProcess | null
  readonly owned: boolean
  readonly kill: () => void
}

type WebSocketFactory = (url: string) => WebSocket

const HEALTH_CHECK_REQUEST_ID = "health-check"

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

export function healthCheck(
  port: number,
  createWebSocket: WebSocketFactory = (url) => new WebSocket(url),
): Promise<DesktopBootstrap | null> {
  return new Promise((resolve) => {
    const ws = createWebSocket(`ws://127.0.0.1:${port}`)
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
      ws.send(JSON.stringify({
        kind: "request",
        method: RPC_METHODS.SERVER_GET_BOOTSTRAP,
        id: HEALTH_CHECK_REQUEST_ID,
        params: {},
      }))
    })

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString())
        if (isBootstrapResponse(msg)) {
          finish(msg.result)
          return
        }

        if (isFailedBootstrapResponse(msg)) {
          finish(null)
        }
      } catch {
        // Ignore unrelated or malformed frames and keep waiting for the
        // bootstrap RPC response.
      }
    })

    ws.on("error", () => {
      finish(null)
    })

    ws.on("close", () => {
      finish(null)
    })
  })
}

export async function spawnServer(): Promise<ServerProcess> {
  const port = Number(process.env.SERVER_PORT ?? 8787)
  const dbPath = process.env.DB_PATH ?? `${process.env.HOME}/.student-claw/data.db`

  const existingBootstrap = await healthCheck(port)
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

  const child = spawn("bun", ["run", serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: dbPath,
    },
    stdio: "pipe",
  })

  child.stdout?.on("data", (data: Buffer) => {
    console.log(`[server] ${data.toString().trim()}`)
  })

  child.stderr?.on("data", (data: Buffer) => {
    console.error(`[server] ${data.toString().trim()}`)
  })

  // Health check with retry/backoff
  const maxAttempts = 10
  let delay = 500

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, delay))
    const bootstrap = await healthCheck(port)
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

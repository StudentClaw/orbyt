import { spawn, type ChildProcess } from "node:child_process"
import { WebSocket } from "ws"

export interface ServerProcess {
  readonly port: number
  readonly process: ChildProcess
  readonly kill: () => void
}

function healthCheck(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${port}`)
    const timeout = setTimeout(() => {
      ws.close()
      resolve(false)
    }, 2000)

    ws.on("open", () => {
      ws.send(JSON.stringify({
        method: "health.ping",
        id: "health-check",
        params: {},
      }))
    })

    ws.on("message", (data) => {
      clearTimeout(timeout)
      try {
        const msg = JSON.parse(data.toString())
        resolve(msg.event === "health.pong")
      } catch {
        resolve(false)
      }
      ws.close()
    })

    ws.on("error", () => {
      clearTimeout(timeout)
      resolve(false)
    })
  })
}

export async function spawnServer(): Promise<ServerProcess> {
  const port = Number(process.env.SERVER_PORT ?? 8787)
  const dbPath = process.env.DB_PATH ?? `${process.env.HOME}/.student-claw/data.db`

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
    const healthy = await healthCheck(port)
    if (healthy) {
      return {
        port,
        process: child,
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

import { WebSocket } from "ws"
import { RPC_METHODS, WS_PROTOCOL } from "@student-claw/contracts"
import { createId } from "@student-claw/shared-runtime"
import { MemorizeScheduler } from "./memorize-scheduler.js"

const AUTH_PROTOCOL_PREFIX = "auth."
const TRIGGER_TIMEOUT_MS = 60_000

async function triggerMemorizeRun(port: number, authToken: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, [
      WS_PROTOCOL,
      `${AUTH_PROTOCOL_PREFIX}${authToken}`,
    ])

    let settled = false
    const requestId = createId("memorize-trigger")

    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      ws.close()
      if (err) reject(err)
      else resolve()
    }

    const timer = setTimeout(() => {
      finish(new Error("Memorize trigger timed out"))
    }, TRIGGER_TIMEOUT_MS)

    ws.on("open", () => {
      ws.send(JSON.stringify({
        kind: "request",
        method: RPC_METHODS.MEMORIZE_RUN,
        id: requestId,
        params: {},
      }))
    })

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as unknown
        if (
          typeof msg === "object" &&
          msg !== null &&
          "id" in msg &&
          (msg as Record<string, unknown>)["id"] === requestId
        ) {
          finish()
        }
      } catch {
        // ignore malformed frames
      }
    })

    ws.on("error", (err) => {
      finish(err)
    })

    ws.on("close", () => {
      finish()
    })
  })
}

export interface MemorizeManagerDeps {
  readonly port: number
  readonly authToken: string
  readonly getLastRunAt: () => Date | null
  readonly onError?: (err: Error) => void
}

export class MemorizeManager {
  private scheduler: MemorizeScheduler | null = null

  constructor(private readonly deps: MemorizeManagerDeps) {}

  start(): void {
    if (this.scheduler) return

    this.scheduler = new MemorizeScheduler({
      getLastRunAt: this.deps.getLastRunAt,
      onRun: async () => {
        try {
          await triggerMemorizeRun(this.deps.port, this.deps.authToken)
        } catch (err) {
          this.deps.onError?.(err instanceof Error ? err : new Error(String(err)))
        }
      },
    })

    this.scheduler.start()
  }

  stop(): void {
    this.scheduler?.stop()
    this.scheduler = null
  }

  runCatchUpIfNeeded(): void {
    this.scheduler?.runCatchUpIfNeeded()
  }
}

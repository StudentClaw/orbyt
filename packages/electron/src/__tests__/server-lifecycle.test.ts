import { EventEmitter } from "node:events"
import { describe, test, expect } from "bun:test"
import { healthCheck, spawnServer } from "../server/lifecycle.js"

class FakeWebSocket extends EventEmitter {
  constructor(
    readonly url: string,
    private readonly respond: (socket: FakeWebSocket, payload: string) => void,
  ) {
    super()
    queueMicrotask(() => {
      this.emit("open")
    })
  }

  send(payload: string): void {
    this.respond(this, payload)
  }

  close(): void {
    queueMicrotask(() => {
      this.emit("close")
    })
  }
}

describe("Server lifecycle", () => {
  test("ServerProcess interface is well-defined", async () => {
    // Type-level test: ensure the module loads
    expect(typeof spawnServer).toBe("function")
  })

  test("healthCheck ignores lifecycle pushes until the bootstrap response arrives", async () => {
    const bootstrap = {
      wsUrl: "ws://127.0.0.1:8787",
      appVersion: "0.1.0",
      platform: "test",
    }

    const result = await healthCheck(
      8787,
      (url) => new FakeWebSocket(url, (socket, payload) => {
        const request = JSON.parse(payload)

        expect(request.id).toBe("health-check")

        queueMicrotask(() => {
          socket.emit("message", JSON.stringify({
            channel: "server.lifecycle",
            sequence: 1,
            payload: {
              type: "server.ready",
              bootstrap,
            },
          }))
        })

        queueMicrotask(() => {
          socket.emit("message", JSON.stringify({
            kind: "response",
            id: "health-check",
            ok: true,
            result: bootstrap,
          }))
        })
      }) as never,
    )

    expect(result).toEqual(bootstrap)
  })
})

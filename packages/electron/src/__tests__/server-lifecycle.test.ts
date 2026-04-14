import { EventEmitter } from "node:events"
import { describe, test, expect } from "bun:test"
import { healthCheck, spawnServer } from "../server/lifecycle.js"

class FakeWebSocket extends EventEmitter {
  constructor(
    readonly url: string,
    readonly protocols: string[],
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
      wsAuthToken: "a".repeat(64),
      appVersion: "0.1.0",
      platform: "test",
      featureFlags: {
        pluginSystem: false,
      },
    }

    const result = await healthCheck(
      8787,
      { authToken: bootstrap.wsAuthToken },
      (url, protocols) => new FakeWebSocket(url, protocols, (socket, payload) => {
        const request = JSON.parse(payload)

        expect(request.id).toBe("health-check")
        expect(socket.protocols).toEqual([
          "student-claw.v1",
          `auth.${bootstrap.wsAuthToken}`,
        ])

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

  test("healthCheck rejects bootstrap responses from a server with the wrong auth token", async () => {
    const result = await healthCheck(
      8787,
      { authToken: "a".repeat(64) },
      (url, protocols) => new FakeWebSocket(url, protocols, (socket) => {
        queueMicrotask(() => {
          socket.emit("message", JSON.stringify({
            kind: "response",
            id: "health-check",
            ok: true,
            result: {
              wsUrl: "ws://127.0.0.1:8787",
              wsAuthToken: "b".repeat(64),
              appVersion: "0.1.0",
              platform: "test",
              featureFlags: {
                pluginSystem: false,
              },
            },
          }))
        })
      }) as never,
    )

    expect(result).toBeNull()
  })
})

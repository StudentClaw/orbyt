import { EventEmitter } from "node:events"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, test, expect } from "bun:test"
import { healthCheck, resolveServerLaunchSpec, spawnServer } from "../server/lifecycle.js"

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
          "orbyt.v1",
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

  test("resolveServerLaunchSpec uses bun against the source entry in development", () => {
    const spec = resolveServerLaunchSpec({
      isPackaged: false,
    })

    expect(spec.packaged).toBe(false)
    expect(spec.command).toBe("bun")
    expect(spec.args[0]).toBe("run")
    expect(spec.serverPath.endsWith("/packages/server/src/index.ts")).toBe(true)
  })

  test("resolveServerLaunchSpec uses the packaged server entry when the app is packaged", () => {
    const resourcesRoot = mkdtempSync(path.join(tmpdir(), "orbyt-server-launch-"))
    const serverPath = path.join(resourcesRoot, "app.asar", "node_modules", "@orbyt", "server", "dist", "index.js")
    mkdirSync(path.dirname(serverPath), { recursive: true })
    writeFileSync(serverPath, "console.log('server')\n", "utf8")

    try {
      const spec = resolveServerLaunchSpec({
        isPackaged: true,
        resourcesPath: resourcesRoot,
      })

      expect(spec).toEqual({
        command: process.execPath,
        args: [serverPath],
        serverPath,
        packaged: true,
      })
    } finally {
      rmSync(resourcesRoot, { recursive: true, force: true })
    }
  })
})

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { WebSocketServer } from "ws"
import { WebSocket } from "ws"
import { Database as BunDatabase } from "bun:sqlite"
import { RPC_METHODS, type ThreadId, type TurnId } from "@student-claw/contracts"
import { runMigrations } from "../db/migrations/runner.js"
import { routeMessage } from "../ws/Router.js"

function getRandomPort(): number {
  return 10000 + Math.floor(Math.random() * 50000)
}

describe("Server integration", () => {
  let wss: WebSocketServer
  let db: BunDatabase
  let port: number

  beforeAll(async () => {
    const threadId = "thread_1" as ThreadId
    const turnId = "turn_1" as TurnId

    // Setup in-memory DB
    db = new BunDatabase(":memory:")
    db.run("PRAGMA journal_mode = WAL")
    db.run("PRAGMA foreign_keys = ON")
    runMigrations(db)

    // Setup WS server on random port
    port = getRandomPort()
    wss = new WebSocketServer({ port })

    wss.on("connection", (ws) => {
      ws.on("message", async (data) => {
        const response = await routeMessage(data.toString(), ws as never, {
          readiness: {
            awaitReady: async () => undefined,
            markReady: () => undefined,
            isReady: () => true,
          },
          pushBus: {
            registerClient: () => undefined,
            removeClient: () => undefined,
            subscribe: () => undefined,
            publish: async () => 1,
            publishTo: async () => 1,
            getLastSequence: () => 1,
          },
          orchestration: {
            getDesktopBootstrap: async () => ({
              wsUrl: `ws://127.0.0.1:${port}`,
              wsAuthToken: "a".repeat(64),
              appVersion: "0.1.0",
              platform: "test",
              featureFlags: {
                pluginSystem: false,
              },
            }),
            getServerConfig: async () => ({
              appVersion: "0.1.0",
              platform: "test",
              protocolVersion: "rpc-v1",
              capabilities: {
                orchestration: true,
                providerRuntime: true,
                desktopBootstrap: true,
              },
              defaultChatModel: "gpt-5.4-mini",
              chatModels: [
                {
                  id: "gpt-5.4-mini",
                  label: "GPT-5.4 Mini",
                  description: "Fast default model",
                  group: "standard" as const,
                },
              ],
              featureFlags: {
                pluginSystem: false,
              },
            }),
            getSnapshot: async () => ({
              workspaces: [],
              threads: [],
              turns: [],
              providerStatus: "idle" as const,
              providerRuntime: {
                adapter: "codex" as const,
                status: "idle" as const,
                authState: "authenticated" as const,
                lastError: null,
                queuedTurnCount: 0,
                lastUpdatedAt: "2026-04-09T12:00:00.000Z",
              },
              ready: true,
              lastSequence: 1,
            }),
            createWorkspace: async () => ({ workspaceId: "workspace_1" as never }),
            relinkWorkspace: async () => ({ workspaceId: "workspace_1" as never }),
            deleteWorkspace: async () => ({ deleted: true }),
            createThread: async () => ({ threadId }),
            renameThread: async () => ({ threadId }),
            deleteThread: async () => ({ deleted: true }),
            sendTurn: async () => ({ turnId }),
            interruptTurn: async () => ({ interrupted: true }),
            startProviderAuth: async () => ({ started: true }),
            retryProviderInitialize: async () => ({ started: true }),
          },
          database: {
            db,
            get: () => null,
            query: () => [],
            execute: () => undefined,
            transaction: <T>(fn: () => T) => fn(),
            close: () => undefined,
          },
        })
        ws.send(response.response)
      })
    })

    // Wait for server to start
    await new Promise<void>((resolve) => {
      wss.on("listening", resolve)
    })
  })

  afterAll(async () => {
    db.close()
    await new Promise<void>((resolve) => {
      wss.close(() => resolve())
    })
  })

  test("WebSocket connects successfully", async () => {
    const ws = new WebSocket(`ws://localhost:${port}`)
    await new Promise<void>((resolve, reject) => {
      ws.on("open", resolve)
      ws.on("error", reject)
    })
    ws.close()
  })

  test("server.getBootstrap returns bootstrap payload", async () => {
    const ws = new WebSocket(`ws://localhost:${port}`)
    await new Promise<void>((resolve) => ws.on("open", resolve))

    const response = await new Promise<string>((resolve) => {
      ws.on("message", (data) => resolve(data.toString()))
      ws.send(JSON.stringify({
        kind: "request",
        method: RPC_METHODS.SERVER_GET_BOOTSTRAP,
        id: "1",
        params: {},
      }))
    })

    const parsed = JSON.parse(response)
    expect(parsed.ok).toBe(true)
    expect(parsed.result.wsUrl).toContain(String(port))

    ws.close()
  })

  test("invalid JSON returns error response", async () => {
    const ws = new WebSocket(`ws://localhost:${port}`)
    await new Promise<void>((resolve) => ws.on("open", resolve))

    const response = await new Promise<string>((resolve) => {
      ws.on("message", (data) => resolve(data.toString()))
      ws.send("this is not json")
    })

    const parsed = JSON.parse(response)
    expect(parsed.ok).toBe(false)
    expect(parsed.error.code).toBe("parse_error")

    ws.close()
  })

  test("database has all expected tables", () => {
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all()
      .map((t) => t.name)

    expect(tables.length).toBeGreaterThanOrEqual(19)
    expect(tables).toContain("courses")
    expect(tables).toContain("planned_sessions")
    expect(tables).toContain("activity_feed")
    expect(tables).toContain("orchestration_events")
    expect(tables).toContain("orchestration_threads")
  })

  test("disconnects cleanly", async () => {
    const ws = new WebSocket(`ws://localhost:${port}`)
    await new Promise<void>((resolve) => ws.on("open", resolve))

    await new Promise<void>((resolve) => {
      ws.on("close", resolve)
      ws.close()
    })
  })
})

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { WebSocketServer } from "ws"
import { WebSocket } from "ws"
import { Database as BunDatabase } from "bun:sqlite"
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
    // Setup in-memory DB
    db = new BunDatabase(":memory:")
    db.run("PRAGMA journal_mode = WAL")
    db.run("PRAGMA foreign_keys = ON")
    runMigrations(db)

    // Setup WS server on random port
    port = getRandomPort()
    wss = new WebSocketServer({ port })

    wss.on("connection", (ws) => {
      ws.on("message", (data) => {
        const response = routeMessage(data.toString())
        ws.send(response)
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

  test("health.ping returns health.pong", async () => {
    const ws = new WebSocket(`ws://localhost:${port}`)
    await new Promise<void>((resolve) => ws.on("open", resolve))

    const response = await new Promise<string>((resolve) => {
      ws.on("message", (data) => resolve(data.toString()))
      ws.send(JSON.stringify({
        method: "health.ping",
        id: "1",
        params: {},
      }))
    })

    const parsed = JSON.parse(response)
    expect(parsed.event).toBe("health.pong")
    expect(parsed.data.uptime).toBeGreaterThanOrEqual(0)

    ws.close()
  })

  test("invalid JSON returns error event", async () => {
    const ws = new WebSocket(`ws://localhost:${port}`)
    await new Promise<void>((resolve) => ws.on("open", resolve))

    const response = await new Promise<string>((resolve) => {
      ws.on("message", (data) => resolve(data.toString()))
      ws.send("this is not json")
    })

    const parsed = JSON.parse(response)
    expect(parsed.event).toBe("error")
    expect(parsed.data.code).toBe(-32700)

    ws.close()
  })

  test("database has all expected tables", () => {
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all()
      .map((t) => t.name)

    expect(tables.length).toBeGreaterThanOrEqual(11)
    expect(tables).toContain("courses")
    expect(tables).toContain("planned_sessions")
    expect(tables).toContain("activity_feed")
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
